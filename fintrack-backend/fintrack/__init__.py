import os
import ipaddress

from dotenv import load_dotenv
from flask import Flask, current_app, jsonify, request
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
def rate_limit_client_key():
    """Use proxy client headers only when the hosting proxy is explicitly trusted."""
    if current_app.config.get("RATE_LIMIT_TRUST_PROXY_HEADERS"):
        client_ip = request.headers.get("CF-Connecting-IP")
        if client_ip:
            try:
                return str(ipaddress.ip_address(client_ip.strip()))
            except ValueError:
                pass
    return get_remote_address()


limiter = Limiter(key_func=rate_limit_client_key, default_limits=[])


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
        GEMINI_MODEL=os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        CORS_ORIGINS=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if origin.strip()],
        RATELIMIT_STORAGE_URI=os.getenv("RATELIMIT_STORAGE_URI") or os.getenv("REDIS_URL") or "memory://",
        RATE_LIMIT_TRUST_PROXY_HEADERS=os.getenv("RATE_LIMIT_TRUST_PROXY_HEADERS", "false").lower() == "true",
        DEBUG=environment != "production" and os.getenv("FLASK_DEBUG", "false").lower() == "true",
        FINTRACK_ENV=environment,
    )
    if test_config:
        app.config.update(test_config)
    if app.config["FINTRACK_ENV"] == "production":
        app.config["DEBUG"] = False
    if app.config["FINTRACK_ENV"] == "production":
        if not app.config["SQLALCHEMY_DATABASE_URI"].startswith(("postgresql://", "postgresql+psycopg://")):
            raise RuntimeError("DATABASE_URL must use PostgreSQL in production.")
        origins = app.config["CORS_ORIGINS"]
        if not origins or "*" in origins or any(not origin.startswith("https://") for origin in origins):
            raise RuntimeError("CORS_ORIGINS must contain exact HTTPS frontend origins in production.")
    if app.config["FINTRACK_ENV"] == "production" and app.config["RATELIMIT_STORAGE_URI"] == "memory://":
        raise RuntimeError("RATELIMIT_STORAGE_URI must point to a shared Redis-compatible store in production.")
    if not app.testing and app.config["JWT_SECRET_KEY"] == "unsafe-development-key-change-me":
        # Keep local development convenient, but production must supply a secret.
        app.logger.warning("JWT_SECRET_KEY is unset; use a strong secret outside development.")

    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    from . import models  # noqa: F401
    from .routes import api
    app.register_blueprint(api, url_prefix="/api")

    @app.after_request
    def security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
        response.headers.setdefault("Cache-Control", "no-store")
        if app.config["FINTRACK_ENV"] == "production":
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response

    @app.get("/api/health")
    def health():
        from sqlalchemy import text
        db.session.execute(text("SELECT 1"))
        return jsonify(status="ok")

    @jwt.token_in_blocklist_loader
    def is_token_revoked(_header, payload):
        from .models import RevokedToken
        return db.session.get(RevokedToken, payload["jti"]) is not None

    @jwt.unauthorized_loader
    def missing_token(_reason):
        return jsonify(error="Authentication required."), 401

    @jwt.invalid_token_loader
    def invalid_token(_reason):
        return jsonify(error="Invalid authentication token."), 401

    @jwt.expired_token_loader
    def expired_token(_header, _payload):
        return jsonify(error="Authentication token has expired."), 401

    @jwt.revoked_token_loader
    def revoked_token(_header, _payload):
        return jsonify(error="Authentication token has been revoked."), 401

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify(error=getattr(error, "description", "Bad request.")), 400

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify(error="Resource not found."), 404

    @app.errorhandler(429)
    def rate_limited(_error):
        return jsonify(error="Too many authentication attempts. Please try again later."), 429

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        app.logger.error("Unhandled server error (%s).", type(error).__name__)
        return jsonify(error="An internal server error occurred."), 500

    return app
