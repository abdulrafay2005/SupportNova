import json
import os

from jsonschema import validate
from jsonschema.exceptions import ValidationError


SCHEMA_PATH = os.path.join(
    os.path.dirname(__file__),
    "schemas",
    "complaint_result.json"
)


def load_schema():
    with open(
        SCHEMA_PATH,
        "r",
        encoding="utf-8"
    ) as file:
        return json.load(file)


def validate_complaint_result(result):
    schema = load_schema()

    try:
        validate(
            instance=result,
            schema=schema
        )

        return {
            "valid": True,
            "error": None
        }

    except ValidationError as error:

        return {
            "valid": False,
            "error": error.message
        }


if __name__ == "__main__":

    test_result = {
        "complaint": {
            "id": "",
            "title": "",
            "description": "Test complaint"
        },
        "classification": {
            "category": "Payments & Billing",
            "subcategory": "Duplicate charge",
            "department": "Payments & Finance"
        },
        "sentiment": {
            "label": "",
            "emotion": ""
        },
        "entities": {
            "order_id": "",
            "transaction_id": "",
            "product": "",
            "amount": "",
            "date": ""
        },
        "policies": [],
        "resolution": {
            "steps": [],
            "explanation": ""
        },
        "escalation": {
            "required": False,
            "level": "",
            "reason": ""
        },
        "routing": {
            "primary_department": "Payments & Finance",
            "supporting_departments": []
        },
        "customer_response": "",
        "follow_up": {
            "required": False,
            "message": ""
        },
        "agent_guidance": "",
        "clarification_questions": []
    }

    result = validate_complaint_result(test_result)

    if result["valid"]:
        print("Schema validation successful.")
    else:
        print("Schema validation failed:")
        print(result["error"])