import pytest

from fintrack import create_app, db


@pytest.fixture
def app():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite://",
        "JWT_SECRET_KEY": "test-secret-that-is-long-enough-for-hmac",
        "AI_PROVIDER": "gemini",
        "GEMINI_API_KEY": None,
        "GEMINI_MODEL": "gemini-3.5-flash-lite",
        "CORS_ORIGINS": ["http://localhost:3000"],
    })
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def register(client, email):
    response = client.post("/api/auth/signup", json={
        "name": "Test User", "email": email, "password": "secure-password-123"
    })
    assert response.status_code == 201
    return response.get_json()["access_token"]


@pytest.fixture
def auth_headers(client):
    return {"Authorization": f"Bearer {register(client, 'a@example.com')}"}
