"""Local UI test fixture only. Never a live-model demonstration.

python -m uvicorn tests.trace_demo_server:app --app-dir backend --port 8014
The UI explicitly displays model_used=mock-provider-not-live.
"""
import time
from api import create_app
from app.v1.trace import Explanation, safe_provider_dependency


class MockProvider:
    model = "mock-provider-not-live"

    def generate(self, question, evidence, limitations):
        time.sleep(2)
        if "failure" in question.lower():
            raise TimeoutError("deliberate UI test failure")
        return Explanation(
            interpretation="The reported conditions describe the cited experiment. Missing measurements limit comparison across investigations.",
            evidence_ids=[evidence[0].evidence_id],
        )


app = create_app()
app.dependency_overrides[safe_provider_dependency] = lambda: MockProvider()
