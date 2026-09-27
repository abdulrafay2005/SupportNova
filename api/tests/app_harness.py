"""
Import `api.main` inside a test environment.

`ml/rule_engine.py` and `ml/genai.py` load trained model files and
API clients at import time, and the trained models are not part of
the repository. This harness registers import-time stand-ins for
those two modules only, so the FastAPI application object (routes,
dependencies) can be inspected without a model directory, a GenAI
key or a live MongoDB instance.

Nothing here replaces application logic: only the two ML entry
points that the API imports are stubbed, and no test in this file
exercises complaint analysis.
"""

import os
import sys
import types


def _install_ml_stubs():
    if "rule_engine" not in sys.modules:
        rule_engine = types.ModuleType("rule_engine")

        def analyze_complaint(*_args, **_kwargs):
            raise RuntimeError(
                "rule_engine stub: analysis is not exercised in "
                "route tests"
            )

        rule_engine.analyze_complaint = analyze_complaint
        sys.modules["rule_engine"] = rule_engine

    if "genai" not in sys.modules:
        genai = types.ModuleType("genai")

        def analyze_with_ai(*_args, **_kwargs):
            raise RuntimeError(
                "genai stub: analysis is not exercised in route "
                "tests"
            )

        genai.analyze_with_ai = analyze_with_ai
        sys.modules["genai"] = genai


def load_app():
    os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017")
    os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")
    os.environ.setdefault("GEMINI_API_KEY", "test-only-key")

    _install_ml_stubs()

    from api.main import app

    return app


def route_map(app):
    """`{path: {method, ...}}` for every registered API route."""

    mapping = {}

    for route in app.routes:
        methods = getattr(route, "methods", None)

        if not methods:
            continue

        mapping.setdefault(route.path, set()).update(methods)

    return mapping


def route_dependencies(app, path, method):
    """Names of the dependency callables guarding a route."""

    for route in app.routes:
        methods = getattr(route, "methods", None)

        if not methods or route.path != path:
            continue

        if method.upper() not in methods:
            continue

        names = []

        for dependency in route.dependant.dependencies:
            call = dependency.call
            names.append(getattr(call, "__qualname__", str(call)))

        return names

    return None
