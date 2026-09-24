"""
SupportNova Prompt Manager

Centralized prompt loading and version management.
"""

import importlib
import os


DEFAULT_PROMPT_VERSION = "1.0.0"


PROMPT_REGISTRY = {
    "complaint_analysis": {
        "1.0.0": (
            "prompts.complaint_analysis.v1"
        )
    }
}


def get_prompt_version():
    """
    Return the configured SupportNova prompt version.

    Environment variable:

        SUPPORTNOVA_PROMPT_VERSION

    If it is not configured, the default version is used.
    """

    return os.getenv(
        "SUPPORTNOVA_PROMPT_VERSION",
        DEFAULT_PROMPT_VERSION
    ).strip()


def get_prompt_module(
    prompt_name="complaint_analysis",
    version=None
):
    """
    Load a registered prompt module.
    """

    if version is None:
        version = get_prompt_version()

    prompt_versions = PROMPT_REGISTRY.get(
        prompt_name
    )

    if prompt_versions is None:
        raise ValueError(
            f"Unknown SupportNova prompt: {prompt_name}"
        )

    module_path = prompt_versions.get(
        version
    )

    if module_path is None:
        raise ValueError(
            f"Unsupported prompt version: {version}"
        )

    return importlib.import_module(
        module_path
    )


def build_prompt(
    trusted_data,
    prompt_name="complaint_analysis",
    version=None
):
    """
    Build a versioned SupportNova prompt.
    """

    module = get_prompt_module(
        prompt_name=prompt_name,
        version=version
    )

    return module.build_prompt(
        trusted_data
    )


def get_prompt_metadata(
    prompt_name="complaint_analysis",
    version=None
):
    """
    Return metadata about the active prompt.
    """

    if version is None:
        version = get_prompt_version()

    module = get_prompt_module(
        prompt_name=prompt_name,
        version=version
    )

    return {
        "prompt_name": prompt_name,
        "version": version,
        "module": module.__name__,
        "prompt_version": getattr(
            module,
            "VERSION",
            version
        )
    }