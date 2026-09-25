# FINTRACK

FINTRACK is a personal finance web application with a React single-page frontend and a Flask JSON API. It supports account-based finance tracking and uses PostgreSQL in its production deployment configuration.

## Project layout

- `fintrack-frontend/` — React application, browser API client, authentication state and screens.
- `fintrack-backend/` — Flask API, SQLAlchemy models, Alembic migrations, tests and the explicit legacy expense importer.
- `render.yaml` — optional Render Blueprint for the frontend, API, PostgreSQL database and shared rate-limit store. Adding this file does not deploy or provision anything by itself.

## Run locally

Backend (PowerShell):

```powershell
cd fintrack-backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
flask --app app db upgrade
flask --app app run
```

Frontend in another terminal:

```powershell
cd fintrack-frontend
npm ci
Copy-Item .env.example .env
npm start
```

Local API URL: `http://localhost:5000/api`; local frontend URL: `http://localhost:3000`.

## Production configuration

Production uses the Gunicorn WSGI server and a PostgreSQL database. Configure environment variables through the hosting provider's secret manager, not committed files:

- `FINTRACK_ENV=production`
- `JWT_SECRET_KEY` — a randomly generated high-entropy secret.
- `DATABASE_URL` — PostgreSQL connection URI.
- `REDIS_URL` or `RATELIMIT_STORAGE_URI` — private shared Redis-compatible storage for distributed authentication rate limits. Production startup rejects the process-local memory store.
- `RATE_LIMIT_TRUST_PROXY_HEADERS=true` only when the app is behind a trusted proxy that overwrites `CF-Connecting-IP`. The Render template enables this for Render's edge proxy; do not enable it behind an untrusted proxy.
- `CORS_ORIGINS` — comma-separated exact HTTPS origins for the deployed frontend (no wildcard).
- `AI_PROVIDER=gemini`; optional backend-only `GEMINI_API_KEY` and `GEMINI_MODEL` (defaults to `gemini-3.5-flash-lite`, selectable as `gemini-3.1-flash-lite`).
- Frontend build variable `REACT_APP_API_URL` — full HTTPS API base URL ending in `/api`.

Deployments must run `flask --app app db upgrade` before starting the web process. The API health endpoint is `GET /api/health`; it checks database connectivity. Use `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 60` from `fintrack-backend`.

### Render deployment steps

1. Push this repository to a Git provider supported by Render and choose **New → Blueprint** for that repository; Render reads the root `render.yaml`.
2. Review the proposed API, static-site, Key Value and PostgreSQL resources and their plans/pricing. The Blueprint defines paid compute plans; confirm PostgreSQL storage/backup/retention settings before provisioning.
3. When prompted for unsynchronized environment variables, set `CORS_ORIGINS` to the exact HTTPS static-site origin and `REACT_APP_API_URL` to the exact HTTPS API URL plus `/api`. Set `GEMINI_API_KEY` only if enabling the AI endpoints. The template generates `JWT_SECRET_KEY` and wires PostgreSQL and Key Value connection strings through private service references.
4. Apply the Blueprint. Its API pre-deploy command runs `flask --app app db upgrade`; the backend starts under Gunicorn and Render checks `/api/health`. The static site uses `build` as its publish directory and a rewrite for client-side routes.
5. After the first deploy, confirm the API health check, visit the frontend, sign up, verify the dashboard and logout, and inspect API logs for errors without sharing secret values. Verify the exact frontend origin in `CORS_ORIGINS` if Render assigned a different service hostname.

`render.yaml` is only a deployment template. These steps require your Render and Git accounts and are not performed here. Render supports root-relative commands/publish paths for monorepo services and a pre-deploy command for migrations; its static-site headers are applied at the hosting layer ([Blueprint reference](https://render.com/docs/blueprint-spec), [monorepo support](https://render.com/docs/monorepo-support), [static-site headers](https://render.com/docs/static-site-headers)).

## Authentication and security notes

The browser sends short-lived bearer JWTs in the `Authorization` header and keeps the access token in `sessionStorage`; it clears the token after logout or an unauthorized response. This avoids putting credentials in URLs or persistent browser storage, but session storage remains readable by JavaScript on the page. A future HttpOnly-cookie migration should be done as a coordinated change including CSRF protection, credentialed CORS, cookie domain/SameSite/Secure settings and frontend changes. Production uses exact-origin CORS, HSTS and security headers; signup/login have IP-based limits backed by shared storage.

All finance queries are scoped by authenticated user ID. Avoid adding request-body, authorization-header, financial-record or provider-payload logging. AI provider calls are backend-only; see [backend documentation](fintrack-backend/README.md#gemini-data-handling) for the exact minimized fields sent and the current free-tier data-use note.

FINTRACK uses Google Gemini through the backend for AI-assisted savings advice and financial goal planning. Gemini availability depends on the selected model and the limits of Google's current API tier. API keys must remain server-side. The next-month expense forecast is a deterministic statistical calculation over monthly expense totals; Gemini supplies separate savings and goal recommendations and does not generate the forecast number.

## Verification

See backend tests in `fintrack-backend/tests/`. From that directory, install `pip install -r requirements-dev.txt` and run `python -m pytest`. From `fintrack-frontend/`, run `npm test -- --watchAll=false` and `npm run build`. No live PostgreSQL, Gemini API key, or hosting account is required for these checks; PostgreSQL-specific deployment should also be verified against a staging database before public launch.

## Legacy import

Legacy SQLite expense data is not imported automatically. Follow the dry-run and explicit-import process documented in [backend documentation](fintrack-backend/README.md#legacy-expense-import), taking care to select the account that should own the records.
