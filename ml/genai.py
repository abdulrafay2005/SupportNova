import json
import os

from dotenv import load_dotenv
from openai import OpenAI

from prompt_manager import (build_prompt, get_prompt_metadata)
from schema_validator import validate_complaint_result
from ai_output_guard import validate_ai_output


load_dotenv()


MODEL_NAME = "gpt-5.6-luna"


# ============================================================
# OPENAI CONFIGURATION
# ============================================================

def openai_enabled():
    """
    Check whether OpenAI API calls are enabled.

    OPENAI_ENABLED=false
        -> No API call is made.

    OPENAI_ENABLED=true
        -> OpenAI API is used.
    """

    return os.getenv(
        "OPENAI_ENABLED",
        "false"
    ).lower() == "true"


def get_client():
    """
    Create the OpenAI client using the API key
    stored in the environment.
    """

    api_key = os.getenv(
        "OPENAI_API_KEY"
    )

    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY was not found. "
            "Make sure it exists in the .env file."
        )

    return OpenAI(
        api_key=api_key
    )


# ============================================================
# TRUSTED INTELLIGENCE
# ============================================================

def create_intelligence(result):
    """
    Convert the deterministic SupportNova rule-engine
    result into trusted information for the AI layer.

    The AI receives this information as trusted context,
    but is not allowed to modify deterministic fields.
    """

    complaint = result.get(
        "complaint",
        {}
    )

    classification = result.get(
        "classification",
        {}
    )

    escalation = result.get(
        "escalation",
        {}
    )

    routing = result.get(
        "routing",
        {}
    )

    intelligence = {

        "complaint": {
            "id": complaint.get(
                "complaint_id",
                ""
            ),

            "title": complaint.get(
                "title",
                ""
            ),

            "description": complaint.get(
                "text",
                ""
            )
        },

        # ----------------------------------------------------
        # Deterministic classification
        # ----------------------------------------------------

        "classification": {
            "category": classification.get(
                "category",
                ""
            ),

            "subcategory": classification.get(
                "subcategory",
                ""
            ),

            "department": classification.get(
                "department",
                ""
            )
        },

        # ----------------------------------------------------
        # AI-generated fields
        # ----------------------------------------------------

        "sentiment": {
            "label": "",
            "emotion": ""
        },

        "entities": {
            "order_id": complaint.get("order_id", ""),
            "transaction_id": complaint.get("transaction_id", ""),
            "product": complaint.get("product", ""),
            "amount": complaint.get("amount", ""),
            "date": complaint.get("date", "")
        },

        # ----------------------------------------------------
        # Deterministic policies
        # ----------------------------------------------------

        "policies": result.get(
            "policies",
            []
        ),

        # ----------------------------------------------------
        # Deterministic resolution rules
        # ----------------------------------------------------

        "resolution": {
            "steps": result.get(
                "actions",
                {}
            ).get(
                "resolution",
                []
            ),

            "explanation": ""
        },

        # ----------------------------------------------------
        # Deterministic escalation
        # ----------------------------------------------------

        "escalation": {
            "required": escalation.get(
                "required",
                False
            ),

            "level": escalation.get(
                "highest_severity",
                "Standard"
            ),

            "reason": "",

            "rules": escalation.get(
                "rules",
                []
            )
        },

        # ----------------------------------------------------
        # Deterministic routing
        # ----------------------------------------------------

        "routing": routing.copy(),

        # ----------------------------------------------------
        # AI-generated response fields
        # ----------------------------------------------------

        "prompt": {
            "name": "complaint_analysis",
            "version": get_prompt_metadata()["version"]
        },

        "customer_response": "",

        "follow_up": {
            "required": False,
            "message": ""
        },

        "agent_guidance": "",

        "clarification_questions": []
    }

    return intelligence


# ============================================================
# OPENAI PROMPT
# ============================================================

def build_openai_prompt(intelligence):
    """
    Build the currently configured versioned
    SupportNova complaint-analysis prompt.
    """

    trusted_data = json.dumps(
        intelligence,
        indent=2,
        ensure_ascii=False
    )

    return build_prompt(
        trusted_data
    )

# ============================================================
# AI GENERATION
# ============================================================

def generate_ai_fields(intelligence):
    """
    Send trusted SupportNova data to OpenAI and validate
    the returned AI output.

    Validation happens in two stages:

    1. JSON/schema validation
    2. Deterministic hallucination/unsupported-claim guard

    Any failure raises ValueError and is handled by
    analyze_with_ai().
    """

    prompt_metadata = get_prompt_metadata()

    print(
        "Prompt:",
        prompt_metadata["prompt_name"],
        "v" + prompt_metadata["version"]
    )

    client = get_client()

    prompt = build_openai_prompt(
        intelligence
    )

    response = client.responses.create(
        model=MODEL_NAME,
        input=prompt
    )

    raw_output = response.output_text.strip()

    if not raw_output:
        raise ValueError(
            "OpenAI returned an empty response."
        )

    # --------------------------------------------------------
    # Parse JSON
    # --------------------------------------------------------

    try:

        ai_data = json.loads(
            raw_output
        )

    except json.JSONDecodeError as error:

        raise ValueError(
            "OpenAI returned invalid JSON: "
            + str(error)
        )

    # --------------------------------------------------------
    # Schema validation
    # --------------------------------------------------------

    validation = validate_complaint_result(
        {
            **intelligence,
            **ai_data
        }
    )

    if not validation["valid"]:

        raise ValueError(
            "OpenAI result failed schema validation: "
            + str(validation["error"])
        )

    # --------------------------------------------------------
    # Hallucination / unsupported-claim guard
    # --------------------------------------------------------

    guard_result = validate_ai_output(
        intelligence,
        ai_data
    )

    if not guard_result["valid"]:

        raise ValueError(
            "OpenAI output failed hallucination guard: "
            + "; ".join(
                guard_result["violations"]
            )
        )

    return ai_data


# ============================================================
# AI RESULT MERGING
# ============================================================

def merge_ai_result(intelligence, ai_data):
    """
    Merge AI-generated fields into the trusted result.

    Deterministic fields remain untouched.
    """

    final_result = dict(
        intelligence
    )

    # --------------------------------------------------------
    # Fields OpenAI is allowed to generate
    # --------------------------------------------------------

    allowed_ai_fields = {
        "sentiment",
        "entities",
        "customer_response",
        "follow_up",
        "agent_guidance",
        "clarification_questions"
    }

    for field in allowed_ai_fields:

        if field in ai_data:

            final_result[field] = (
                ai_data[field]
            )

    # --------------------------------------------------------
    # Resolution explanation
    # --------------------------------------------------------

    if "resolution" in ai_data:

        if isinstance(
            ai_data["resolution"],
            dict
        ):

            if "explanation" in ai_data["resolution"]:

                final_result[
                    "resolution"
                ]["explanation"] = (
                    ai_data["resolution"][
                        "explanation"
                    ]
                )

    # --------------------------------------------------------
    # Escalation reason
    # --------------------------------------------------------

    if "escalation" in ai_data:

        if isinstance(
            ai_data["escalation"],
            dict
        ):

            if "reason" in ai_data["escalation"]:

                final_result[
                    "escalation"
                ]["reason"] = (
                    ai_data["escalation"][
                        "reason"
                    ]
                )

    return final_result


# ============================================================
# SAFE FALLBACK
# ============================================================

def safe_ai_fallback(
    intelligence,
    reason=""
):
    """
    Safe result returned when the AI layer fails.

    Deterministic SupportNova information is preserved.

    No unvalidated AI-generated content is returned.
    """

    return {

        **intelligence,

        "sentiment": {
            "label": "neutral",
            "emotion": ""
        },

        "entities": {
            "order_id": "",
            "transaction_id": "",
            "product": "",
            "amount": "",
            "date": ""
        },

        "customer_response": (
            "Your complaint has been received "
            "and is being handled using SupportNova's "
            "standard policy process. "
            "Additional verification may be required "
            "before a final resolution can be provided."
        ),

        "follow_up": {
            "required": True,
            "message": (
                "A support agent should review "
                "the complaint before a final response "
                "is sent."
            )
        },

        "agent_guidance": (
            "AI-generated content was not accepted. "
            "Use the deterministic classification, "
            "policy, escalation, routing, and resolution "
            "information."
        ),

        "clarification_questions": [],

        "ai_guard": {
            "blocked": True,
            "reason": reason
        }
    }


# ============================================================
# COMPLETE AI PIPELINE
# ============================================================

def analyze_with_ai(result):
    """
    Complete SupportNova AI pipeline.

    Deterministic Rule Engine
            ↓
    Trusted Intelligence
            ↓
    Check OPENAI_ENABLED
            ↓
    OpenAI
            ↓
    JSON validation
            ↓
    Hallucination guard
            ↓
    Merge approved AI fields
            ↓
    Final result

    If OpenAI is disabled:
        deterministic result is returned.

    If OpenAI fails:
        deterministic information is preserved and
        a safe fallback is returned.

    If the AI output fails validation:
        the output is rejected and a safe fallback
        is returned.
    """

    intelligence = create_intelligence(
        result
    )

    # --------------------------------------------------------
    # OpenAI disabled
    # --------------------------------------------------------

    if not openai_enabled():

        print(
            "OpenAI disabled. "
            "Skipping API call."
        )

        return intelligence

    # --------------------------------------------------------
    # OpenAI enabled
    # --------------------------------------------------------

    print(
        "OpenAI enabled. "
        "Sending request..."
    )

    try:

        ai_data = generate_ai_fields(
            intelligence
        )

        final_result = merge_ai_result(
            intelligence,
            ai_data
        )

        return final_result

    except Exception as error:

        print(
            "OpenAI/AI validation failed:"
        )

        print(
            str(error)
        )

        print(
            "Using deterministic safe fallback."
        )

        return safe_ai_fallback(
            intelligence,
            str(error)
        )


# ============================================================
# DISPLAY
# ============================================================

def print_intelligence(result):
    """
    Pretty-print the final SupportNova
    intelligence result.
    """

    print("\n")

    print(
        "=" * 70
    )

    print(
        "SUPPORTNOVA AI INTELLIGENCE RESULT"
    )

    print(
        "=" * 70
    )

    print(
        json.dumps(
            result,
            indent=2,
            ensure_ascii=False
        )
    )


# ============================================================
# DIRECT EXECUTION
# ============================================================

if __name__ == "__main__":

    print(
        "=" * 70
    )

    print(
        "SUPPORTNOVA OPENAI GENAI LAYER"
    )

    print(
        "=" * 70
    )

    print()

    print(
        "Model:",
        MODEL_NAME
    )

    print(
        "OpenAI enabled:",
        openai_enabled()
    )

    print(
        "OpenAI integration ready."
    )