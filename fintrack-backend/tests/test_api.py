from datetime import date
import json

from conftest import register


def test_auth_validation_and_logout(client):
    assert client.get("/api/dashboard").status_code == 401
    assert client.post("/api/auth/signup", json={"name": "X", "email": "invalid", "password": "123"}).status_code == 400
    token = register(client, "auth@example.com")
    assert client.post("/api/auth/signup", json={"name": "X", "email": "auth@example.com", "password": "secure-password-123"}).status_code == 409
    login = client.post("/api/auth/login", json={"email": "auth@example.com", "password": "secure-password-123"})
    assert login.status_code == 200
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    assert client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_expenses_are_private_and_deletable(client):
    token_a = register(client, "owner@example.com")
    token_b = register(client, "other@example.com")
    a = {"Authorization": f"Bearer {token_a}"}
    b = {"Authorization": f"Bearer {token_b}"}
    created = client.post("/api/expenses", headers=a, json={
        "amount": 40.25, "category": "Food", "description": "Lunch", "date": "2026-01-05"
    })
    assert created.status_code == 201
    expense_id = created.get_json()["id"]
    assert len(client.get("/api/expenses", headers=a).get_json()) == 1
    assert len(client.get("/api/expenses?month=2026-01", headers=a).get_json()) == 1
    assert client.get("/api/expenses", headers=b).get_json() == []
    assert client.post("/api/clear-expenses", headers=a).status_code == 404
    assert client.delete(f"/api/expenses/{expense_id}", headers=b).status_code == 404
    assert client.delete(f"/api/expenses/{expense_id}", headers=a).status_code == 204
    assert client.get("/api/expenses", headers=a).get_json() == []
    assert client.post("/api/expenses", headers=a, json={"amount": -1, "category": "Food", "date": "bad"}).status_code == 400


def test_goal_contributions_are_scoped_and_reversed_on_delete(client):
    token_a = register(client, "goal-owner@example.com")
    token_b = register(client, "goal-other@example.com")
    a = {"Authorization": f"Bearer {token_a}"}
    b = {"Authorization": f"Bearer {token_b}"}
    goal = client.post("/api/goals", headers=a, json={
        "name": "Emergency fund", "goal_type": "savings", "target_amount": 1200,
        "current_amount": 0, "target_date": "2027-12-31"
    })
    assert goal.status_code == 201
    goal_id = goal.get_json()["id"]
    assert client.get(f"/api/goals/{goal_id}", headers=b).status_code == 404
    assert client.post(f"/api/goals/{goal_id}/contributions", headers=b, json={"amount": 50}).status_code == 404
    contribution = client.post(f"/api/goals/{goal_id}/contributions", headers=a, json={"amount": 125})
    assert contribution.status_code == 201
    contribution_id = contribution.get_json()["id"]
    assert client.get(f"/api/goals/{goal_id}", headers=a).get_json()["current_amount"] == 125
    assert client.delete(f"/api/goals/{goal_id}/contributions/{contribution_id}", headers=a).status_code == 204


def test_optional_expense_and_goal_descriptions_accept_empty_values(client, auth_headers):
    expense = client.post("/api/expenses", headers=auth_headers, json={
        "amount": 12.50, "category": "Food", "description": "", "date": "2026-09-10"
    })
    assert expense.status_code == 201
    assert expense.get_json()["description"] == ""

    goal = client.post("/api/goals", headers=auth_headers, json={
        "name": "Description-free goal", "goal_type": "Emergency Fund",
        "target_amount": 500, "current_amount": 0, "target_date": "2027-01-15",
    })
    assert goal.status_code == 201
    assert goal.get_json()["description"] == ""
    goal_id = goal.get_json()["id"]
    assert client.get(f"/api/goals/{goal_id}", headers=auth_headers).get_json()["current_amount"] == 0


def test_dashboard_aggregation_and_prediction(client):
    token = register(client, "dashboard@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    assert client.post("/api/income", headers=headers, json={"amount": 3000, "period": "2026-03"}).status_code == 201
    months = []
    year, month = date.today().year, date.today().month
    for amount in (100, 200, 300, 400, 500, 600):
        month = month - 1
        if month == 0:
            year, month = year - 1, 12
        months.append((year, month, amount))
    months.reverse()
    for index, (year, month, amount) in enumerate(months):
        category = "Food" if index < 3 else "Travel"
        assert client.post("/api/expenses", headers=headers, json={
            "amount": amount, "category": category, "date": f"{year:04d}-{month:02d}-10"
        }).status_code == 201
    result = client.get("/api/dashboard", headers=headers).get_json()
    assert result["total_income"] == 3000
    assert result["total_expenses"] == 2100
    assert result["estimated_savings"] == 900
    assert result["category_expenses"] == [{"category": "Food", "amount": 1500}, {"category": "Travel", "amount": 600}]
    forecast = client.get("/api/prediction/next-month", headers=headers).get_json()
    assert forecast["forecast_amount"] == 350
    current = date.today()
    next_month = f"{current.year + (current.month == 12):04d}-{(current.month % 12) + 1:02d}"
    assert forecast["target_period"] == next_month
    assert len(forecast["historical_values"]) == 6


def test_insufficient_forecast_history_and_goal_ai_missing_key(client, auth_headers):
    forecast = client.get("/api/prediction/next-month", headers=auth_headers).get_json()
    assert forecast["forecast_amount"] is None
    assert forecast["confidence"] == "insufficient_history"
    goal = client.post("/api/goals", headers=auth_headers, json={
        "name": "Trip", "goal_type": "travel", "target_amount": 2000,
        "current_amount": 100, "target_date": "2027-12-31"
    })
    response = client.post(f"/api/ai/goals/{goal.get_json()['id']}/plan", headers=auth_headers, json={})
    assert response.status_code == 503
    assert "GEMINI_API_KEY" in response.get_json()["error"]


def test_income_update_delete_and_user_isolation(client):
    token_a = register(client, "income-owner@example.com")
    token_b = register(client, "income-other@example.com")
    a = {"Authorization": f"Bearer {token_a}"}
    b = {"Authorization": f"Bearer {token_b}"}
    created = client.post("/api/income", headers=a, json={"amount": 3000, "period": "2026-08"})
    income_id = created.get_json()["id"]
    assert client.put(f"/api/income/{income_id}", headers=b, json={"amount": 4000, "period": "2026-08"}).status_code == 404
    updated = client.put(f"/api/income/{income_id}", headers=a, json={"amount": 4000, "period": "2026-09"})
    assert updated.status_code == 200
    assert updated.get_json()["amount"] == 4000
    assert client.delete(f"/api/income/{income_id}", headers=b).status_code == 404
    assert client.delete(f"/api/income/{income_id}", headers=a).status_code == 204


def test_missing_gemini_key_returns_service_unavailable(client, auth_headers):
    response = client.post("/api/ai/savings-advice", headers=auth_headers, json={})
    assert response.status_code == 503
    assert "GEMINI_API_KEY" in response.get_json()["error"]


def test_health_and_security_headers(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]


def test_authentication_routes_are_rate_limited(client):
    last_response = None
    for index in range(6):
        last_response = client.post("/api/auth/signup", json={
            "name": f"Rate User {index}", "email": f"rate{index}@example.com",
            "password": "secure-password-123",
        })
    assert last_response.status_code == 429
    assert "error" in last_response.get_json()

    login_response = None
    for _ in range(11):
        login_response = client.post("/api/auth/login", json={
            "email": "missing@example.com", "password": "not-the-password",
        })
    assert login_response.status_code == 429


def test_production_configuration_rejects_unsafe_defaults(monkeypatch):
    from fintrack import create_app
    import pytest

    monkeypatch.setenv("FINTRACK_ENV", "production")
    monkeypatch.setenv("JWT_SECRET_KEY", "a-production-secret-value")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///fintrack.db")
    monkeypatch.setenv("CORS_ORIGINS", "https://fintrack.example")

    with pytest.raises(RuntimeError, match="PostgreSQL"):
        create_app()

    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://user:password@localhost/fintrack",
    )
    monkeypatch.setenv("CORS_ORIGINS", "*")

    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        create_app()

    # Free deployment intentionally uses Flask-Limiter's
    # in-memory storage, so Redis is no longer required.
    monkeypatch.setenv(
        "CORS_ORIGINS",
        "https://fintrack.example",
    )
    monkeypatch.delenv("RATELIMIT_STORAGE_URI", raising=False)
    monkeypatch.delenv("REDIS_URL", raising=False)

    app = create_app()

    assert app.config["FINTRACK_ENV"] == "production"


def test_gemini_payloads_only_contain_approved_aggregates(client, auth_headers, monkeypatch):
    from fintrack import db
    from fintrack.models import User
    from fintrack.services import savings_advice_inputs

    current_period = date.today().strftime("%Y-%m")
    current_date = date.today().isoformat()
    me = client.get("/api/auth/me", headers=auth_headers).get_json()["user"]
    with client.application.app_context():
        user = db.session.get(User, me["id"])
        savings_inputs = savings_advice_inputs(user.id)
    client.post("/api/income", headers=auth_headers, json={"amount": 5000, "period": current_period})
    client.post("/api/expenses", headers=auth_headers, json={
        "amount": 125, "category": "Food", "description": "PRIVATE RAW TRANSACTION TEXT", "date": current_date
    })
    goal = client.post("/api/goals", headers=auth_headers, json={
        "name": "House deposit", "goal_type": "home", "target_amount": 10000,
        "current_amount": 500, "target_date": "2028-12-31", "description": "PRIVATE GOAL TEXT"
    }).get_json()

    captures = []
    response_body = json.dumps({
        "summary": "Your recorded expenses are below recorded income.",
        "observations": ["Food is one recorded category."],
        "savings_opportunities": ["Compare recurring food purchases."],
        "recommendations": ["Review one flexible category this month."],
        "priorities": ["Start by checking this month's food total."],
        "caveats": ["Only recorded data is considered."],
    })

    class FakeModels:
        calls = 0
        def generate_content(self, **kwargs):
            captures.append(kwargs)
            self.calls += 1
            text = response_body if self.calls == 1 else json.dumps({
                    "required_monthly_saving": 250,
                    "progress_summary": "Use the calculated monthly pace as a guide.",
                    "practical_steps": ["Set up a monthly transfer."],
                    "milestones": ["Reach one quarter of the target."],
                    "suggested_spending_adjustments": ["Review optional spending."],
                "warnings": [],
                "caveat": "Your future income and expenses may change.",
            })
            return type("FakeResponse", (), {"text": text})()

    class FakeClient:
        models = FakeModels()

    client.application.config["GEMINI_API_KEY"] = "test-only-key"
    monkeypatch.setattr("fintrack.ai_service._make_gemini_client", lambda _key: FakeClient())

    advice_response = client.post("/api/ai/savings-advice", headers=auth_headers, json={})
    assert advice_response.status_code == 200
    assert advice_response.get_json()["savings_opportunities"]
    advice_call = captures.pop()
    assert advice_call["model"] == client.application.config["GEMINI_MODEL"]
    advice_payload = json.loads(advice_call["contents"])
    assert advice_payload["category_expenses"] == [{"category": "Food", "amount": 125}]
    assert "monthly_spending_history" in advice_payload
    assert "PRIVATE RAW TRANSACTION TEXT" not in str(advice_payload)
    assert not {"id", "user_id", "name", "email", "password", "description"}.intersection(advice_payload)
    assert "PRIVATE RAW TRANSACTION TEXT" not in str(savings_inputs)
    assert "Test User" not in advice_call["contents"]
    assert "a@example.com" not in advice_call["contents"]
    assert "secure-password-123" not in advice_call["contents"]
    assert auth_headers["Authorization"].removeprefix("Bearer ") not in advice_call["contents"]

    goal_response = client.post(f"/api/ai/goals/{goal['id']}/plan", headers=auth_headers, json={})
    assert goal_response.status_code == 200
    assert goal_response.get_json()["milestones"]
    goal_call = captures.pop()
    goal_payload = json.loads(goal_call["contents"])
    goal_fields = goal_payload["goal"]
    assert goal_fields["name"] == "House deposit"
    assert goal_fields["goal_type"] == "home"
    assert "PRIVATE GOAL TEXT" not in str(goal_payload)
    serialized_goal_request = goal_call["contents"] + goal_call["config"].system_instruction
    def nested_keys(value):
        if isinstance(value, dict):
            return set(value).union(*(nested_keys(item) for item in value.values()))
        if isinstance(value, list):
            return set().union(*(nested_keys(item) for item in value))
        return set()

    assert not {"id", "user_id", "email", "password", "description"}.intersection(nested_keys(goal_payload))
    assert "Test User" not in serialized_goal_request
    assert "a@example.com" not in serialized_goal_request
    assert "secure-password-123" not in serialized_goal_request
    assert auth_headers["Authorization"].removeprefix("Bearer ") not in serialized_goal_request
    assert "PRIVATE RAW TRANSACTION TEXT" not in serialized_goal_request
    assert "PRIVATE GOAL TEXT" not in serialized_goal_request


def test_gemini_client_uses_official_sdk_and_server_side_api_key(monkeypatch):
    from google import genai
    from fintrack.ai_service import _make_gemini_client

    captured = {}
    sentinel = object()

    def fake_client(**kwargs):
        captured.update(kwargs)
        return sentinel

    monkeypatch.setattr(genai, "Client", fake_client)
    assert _make_gemini_client("server-only-test-key") is sentinel
    assert captured["api_key"] == "server-only-test-key"
    assert captured["http_options"].timeout == 30000


def test_gemini_rate_limit_and_invalid_key_errors_are_safe(client, auth_headers, monkeypatch):
    class FakeProviderError(Exception):
        def __init__(self, code, secret_text):
            super().__init__(secret_text)
            self.code = code
            self.message = secret_text

    class FakeModels:
        def generate_content(self, **_kwargs):
            raise FakeProviderError(429, "provider detail and sensitive token")

    class FakeClient:
        models = FakeModels()

    client.application.config["GEMINI_API_KEY"] = "test-only-key"
    monkeypatch.setattr("fintrack.ai_service._make_gemini_client", lambda _key: FakeClient())
    limited = client.post("/api/ai/savings-advice", headers=auth_headers, json={})
    assert limited.status_code == 503
    assert "rate limits" not in limited.get_json()["error"].lower()
    assert "sensitive token" not in limited.get_data(as_text=True)

    FakeModels.generate_content = lambda self, **_kwargs: (_ for _ in ()).throw(FakeProviderError(400, "API key not valid; secret provider detail"))
    denied = client.post("/api/ai/savings-advice", headers=auth_headers, json={})
    assert denied.status_code == 503
    assert "invalid" in denied.get_json()["error"].lower()
    assert "secret provider detail" not in denied.get_data(as_text=True)

    FakeModels.generate_content = lambda self, **_kwargs: (_ for _ in ()).throw(FakeProviderError(404, "private model detail"))
    unavailable = client.post("/api/ai/savings-advice", headers=auth_headers, json={})
    assert unavailable.status_code == 503
    assert "model is unavailable" in unavailable.get_json()["error"].lower()
    assert "private model detail" not in unavailable.get_data(as_text=True)

    FakeModels.generate_content = lambda self, **_kwargs: (_ for _ in ()).throw(TimeoutError("private network detail"))
    timeout = client.post("/api/ai/savings-advice", headers=auth_headers, json={})
    assert timeout.status_code == 503
    assert "temporarily unavailable" in timeout.get_json()["error"].lower()
    assert "private network detail" not in timeout.get_data(as_text=True)


def test_gemini_retries_transient_503_then_succeeds(client, auth_headers, monkeypatch):
    class FakeProviderError(Exception):
        code = 503
        status = "UNAVAILABLE"
        message = "private temporary provider detail"

    success = json.dumps({
        "summary": "Recorded spending leaves room for savings.",
        "observations": ["Food is a recorded category."],
        "savings_opportunities": ["Review flexible purchases."],
        "recommendations": ["Set a monthly savings transfer."],
        "priorities": ["Track food spending."],
        "caveats": ["Advice uses recorded data only."],
    })

    class FakeModels:
        calls = 0
        def generate_content(self, **_kwargs):
            self.calls += 1
            if self.calls == 1:
                raise FakeProviderError("private temporary provider detail")
            return type("FakeResponse", (), {"text": success})()

    class FakeClient:
        models = FakeModels()

    sleeps = []
    client.application.config["GEMINI_API_KEY"] = "test-only-key"
    monkeypatch.setattr("fintrack.ai_service._make_gemini_client", lambda _key: FakeClient())
    monkeypatch.setattr("fintrack.ai_service.time.sleep", sleeps.append)
    monkeypatch.setattr("fintrack.ai_service.random.uniform", lambda _low, _high: 0.1)

    response = client.post("/api/ai/savings-advice", headers=auth_headers, json={})

    assert response.status_code == 200
    assert response.get_json()["summary"] == "Recorded spending leaves room for savings."
    assert FakeClient.models.calls == 2
    assert sleeps == [0.6]


def test_gemini_stops_after_maximum_transient_retries(client, auth_headers, monkeypatch, caplog):
    class FakeProviderError(Exception):
        code = 503
        status = "UNAVAILABLE"
        message = "private provider detail"

    class FakeModels:
        calls = 0
        def generate_content(self, **_kwargs):
            self.calls += 1
            raise FakeProviderError("private provider detail")

    class FakeClient:
        models = FakeModels()

    sleeps = []
    client.application.config["GEMINI_API_KEY"] = "test-only-key"
    monkeypatch.setattr("fintrack.ai_service._make_gemini_client", lambda _key: FakeClient())
    monkeypatch.setattr("fintrack.ai_service.time.sleep", sleeps.append)
    monkeypatch.setattr("fintrack.ai_service.random.uniform", lambda _low, _high: 0.1)

    response = client.post("/api/ai/savings-advice", headers=auth_headers, json={})

    assert response.status_code == 503
    assert response.get_json()["error"] == "AI service is temporarily unavailable. Please try again later."
    assert FakeClient.models.calls == 3
    assert sleeps == [0.6, 1.1]
    assert "private provider detail" not in caplog.text
    assert "test-only-key" not in caplog.text
    assert auth_headers["Authorization"] not in caplog.text


def test_gemini_does_not_retry_permanent_client_errors(client, auth_headers, monkeypatch):
    class FakeProviderError(Exception):
        def __init__(self, code):
            self.code = code
            self.status = "INVALID_ARGUMENT" if code == 400 else "UNAUTHENTICATED"
            self.message = "private client error detail"

    class FakeModels:
        def __init__(self, code):
            self.code = code
            self.calls = 0
        def generate_content(self, **_kwargs):
            self.calls += 1
            raise FakeProviderError(self.code)

    class FakeClient:
        def __init__(self, code):
            self.models = FakeModels(code)

    sleeps = []
    monkeypatch.setattr("fintrack.ai_service.time.sleep", sleeps.append)
    for code in (400, 401, 404):
        fake_client = FakeClient(code)
        client.application.config["GEMINI_API_KEY"] = "test-only-key"
        monkeypatch.setattr("fintrack.ai_service._make_gemini_client", lambda _key, fake=fake_client: fake)

        response = client.post("/api/ai/savings-advice", headers=auth_headers, json={})

        assert response.status_code == 503
        assert fake_client.models.calls == 1
    assert sleeps == []


def test_gemini_malformed_and_wrong_shape_outputs_are_rejected(client, auth_headers, monkeypatch):
    class FakeModels:
        text = "not-json"
        def generate_content(self, **_kwargs):
            return type("FakeResponse", (), {"text": self.text})()

    models = FakeModels()
    class FakeClient:
        pass
    fake_client = FakeClient()
    fake_client.models = models
    client.application.config["GEMINI_API_KEY"] = "test-only-key"
    monkeypatch.setattr("fintrack.ai_service._make_gemini_client", lambda _key: fake_client)

    malformed = client.post("/api/ai/savings-advice", headers=auth_headers, json={})
    assert malformed.status_code == 502
    assert "invalid response" in malformed.get_json()["error"].lower()

    models.text = json.dumps({"summary": "Missing the required arrays."})
    invalid_shape = client.post("/api/ai/savings-advice", headers=auth_headers, json={})
    assert invalid_shape.status_code == 502


def test_gemini_configuration_uses_free_tier_model(client):
    assert client.application.config["AI_PROVIDER"] == "gemini"
    assert client.application.config["GEMINI_MODEL"] == "gemini-3.5-flash-lite"
