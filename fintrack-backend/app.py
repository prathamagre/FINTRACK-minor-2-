"""WSGI entry point. Use ``flask --app app run`` for local development."""
from fintrack import create_app

app = create_app()

if __name__ == "__main__":
    # The built-in server is development-only; production uses Gunicorn.
    if app.config["FINTRACK_ENV"] == "production":
        raise RuntimeError("Use the configured production WSGI server (Gunicorn).")
    app.run(debug=app.config["DEBUG"])
