import os

from dotenv import load_dotenv
from flask import Flask, current_app, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from sqlalchemy.engine import Engine

db = SQLAlchemy()
jwt = JWTManager()
migrate = Migrate()

# Free deployment:
# Use Flask-Limiter's in-memory storage instead of an external Redis service.
# This keeps the application compatible with Render's $0 Free plan.
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="memory://",
    default_limits=[],
)


@event.listens_for(Engine, "connect")
def enable_sqlite_foreign_keys(connection, _record):
    if connection.__class__.__module__.startswith("sqlite3"):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def create_app(test_config=None):
    load_dotenv()

    app = Flask(__name__)

    database_url = os.getenv("DATABASE_URL", "sqlite:///fintrack.db")

    # Normalize PostgreSQL URLs for psycopg.
    if database_url.startswith("postgres://"):
        database_url = "postgresql+psycopg://" + database_url[len("postgres://"):]
    elif database_url.startswith("postgresql://"):
        database_url = "postgresql+psycopg://" + database_url[len("postgresql://"):]

    environment = os.getenv("FINTRACK_ENV", "development").lower()
    jwt_secret = os.getenv("JWT_SECRET_KEY")

    if environment == "production" and not jwt_secret:
        raise RuntimeError("JWT_SECRET_KEY must be configured in production.")

    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI=database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,

        MAX_CONTENT_LENGTH=1024 * 1024,

        JWT_SECRET_KEY=jwt_secret or "unsafe-development-key-change-me",
        JWT_ACCESS_TOKEN_EXPIRES=3600,

        AI_PROVIDER=os.getenv("AI_PROVIDER", "gemini").strip().lower(),
        GEMINI_API_KEY=os.getenv("GEMINI_API_KEY"),
        GEMINI_MODEL=os.getenv(
            "GEMINI_MODEL",
            "gemini-3.5-flash-lite",
        ),

        CORS_ORIGINS=[
            origin.strip()
            for origin in os.getenv(
                "CORS_ORIGINS",
                "http://localhost:3000",
            ).split(",")
            if origin.strip()
        ],

        # Keep this setting for compatibility/documentation,
        # but Redis is no longer required for the free deployment.
        RATE_LIMIT_TRUST_PROXY_HEADERS=False,

        DEBUG=(
            environment != "production"
            and os.getenv("FLASK_DEBUG", "false").lower() == "true"
        ),

        FINTRACK_ENV=environment,
    )

    if test_config:
        app.config.update(test_config)

    # Never allow debug mode in production.
    if app.config["FINTRACK_ENV"] == "production":
        app.config["DEBUG"] = False

    # Production requires PostgreSQL.
    if app.config["FINTRACK_ENV"] == "production":
        if not app.config["SQLALCHEMY_DATABASE_URI"].startswith(
            ("postgresql://", "postgresql+psycopg://")
        ):
            raise RuntimeError(
                "DATABASE_URL must use PostgreSQL in production."
            )

        # Production must use exact HTTPS frontend origins.
        origins = app.config["CORS_ORIGINS"]

        if (
            not origins
            or "*" in origins
            or any(not origin.startswith("https://") for origin in origins)
        ):
            raise RuntimeError(
                "CORS_ORIGINS must contain exact HTTPS frontend origins in production."
            )

    if (
        not app.testing
        and app.config["JWT_SECRET_KEY"]
        == "unsafe-development-key-change-me"
    ):
        app.logger.warning(
            "JWT_SECRET_KEY is unset; use a strong secret outside development."
        )

    # Initialize extensions.
    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)

    # API-only CORS.
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": app.config["CORS_ORIGINS"]
            }
        },
    )

    # Import models/routes after extensions are initialized.
    from . import models  # noqa: F401
    from .routes import api

    app.register_blueprint(api, url_prefix="/api")

    @app.after_request
    def security_headers(response):
        response.headers.setdefault(
            "X-Content-Type-Options",
            "nosniff",
        )
        response.headers.setdefault(
            "X-Frame-Options",
            "DENY",
        )
        response.headers.setdefault(
            "Referrer-Policy",
            "strict-origin-when-cross-origin",
        )
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()",
        )
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'none'; frame-ancestors 'none'; "
            "base-uri 'none'",
        )
        response.headers.setdefault(
            "Cache-Control",
            "no-store",
        )

        if app.config["FINTRACK_ENV"] == "production":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )

        return response

    @app.get("/api/health")
    def health():
        from sqlalchemy import text

        db.session.execute(text("SELECT 1"))
        return jsonify(status="ok")

    # JWT revocation.
    @jwt.token_in_blocklist_loader
    def is_token_revoked(_header, payload):
        from .models import RevokedToken

        return db.session.get(
            RevokedToken,
            payload["jti"],
        ) is not None

    @jwt.unauthorized_loader
    def missing_token(_reason):
        return jsonify(error="Authentication required."), 401

    @jwt.invalid_token_loader
    def invalid_token(_reason):
        return jsonify(error="Invalid authentication token."), 401

    @jwt.expired_token_loader
    def expired_token(_header, _payload):
        return jsonify(
            error="Authentication token has expired."
        ), 401

    @jwt.revoked_token_loader
    def revoked_token(_header, _payload):
        return jsonify(
            error="Authentication token has been revoked."
        ), 401

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify(
            error=getattr(error, "description", "Bad request.")
        ), 400

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify(
            error="Resource not found."
        ), 404

    @app.errorhandler(429)
    def rate_limited(_error):
        return jsonify(
            error="Too many authentication attempts. "
                  "Please try again later."
        ), 429

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()

        app.logger.error(
            "Unhandled server error (%s).",
            type(error).__name__,
        )

        return jsonify(
            error="An internal server error occurred."
        ), 500

    return app