# FINTRACK backend

Flask API with SQLAlchemy models, bearer JWT authentication, Alembic migrations, and SQLite/PostgreSQL support.

## Local setup

Use Python 3.10 or newer. From this directory:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
$env:FLASK_APP = "app:app"
flask db upgrade
flask --app app run
```

For production, install/run Gunicorn (`gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 60`) and never use Flask's development server. Set `FINTRACK_ENV=production`, a high-entropy `JWT_SECRET_KEY`, PostgreSQL `DATABASE_URL`, exact HTTPS frontend origins in `CORS_ORIGINS`, and a private shared Redis-compatible `REDIS_URL` or `RATELIMIT_STORAGE_URI`. Production startup rejects a missing JWT secret, SQLite, wildcard/non-HTTPS CORS origins, and the process-local memory limiter store. Run `flask --app app db upgrade` as a pre-deploy step before serving traffic; schema creation is not performed at application startup. `GET /api/health` performs a database connectivity check for host health probes.

The API sets content-type, frame, referrer, permissions and restrictive content-security headers. HSTS is enabled in production. API responses are marked `no-store`, and request bodies are capped at 1 MiB. Signup is limited to 5 attempts per source IP per hour and login to 10 per minute; configure the shared store to ensure limits apply across workers and restarts. By default, the key uses the socket address. `RATE_LIMIT_TRUST_PROXY_HEADERS=true` opts into reading the trusted edge's `CF-Connecting-IP`; only enable this behind a proxy that overwrites that header (the Render template does so for Render's edge). Untrusted `X-Forwarded-For` values are ignored. Error responses are generic and server logs avoid exception messages and request payloads. Do not add logging of request bodies, authorization headers, finance records or AI prompts.

`DATABASE_URL` defaults to an instance-local SQLite file only for development/testing. For PostgreSQL, provide a `postgresql://...` URL; the application uses psycopg 3. Configure `AI_PROVIDER=gemini` and a backend-only `GEMINI_API_KEY` to enable generative AI. `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`; set it to `gemini-3.1-flash-lite` to select that still-documented alternative. AI endpoints return HTTP 503 when the key/provider is unavailable and safe generic messages for provider failures; transient provider 5xx responses receive bounded retries. Malformed output returns HTTP 502. Automated tests mock Gemini and never call the real provider.

### Gemini data handling

Gemini requests are made only by the backend after an authenticated user explicitly requests advice or a goal plan. Savings advice sends total income, total expenses, calculated savings, savings rate, current-month expense total, category totals, and the last six monthly income/spending aggregates. Goal planning sends the selected goal's name/type/target/current amount/target date, calculated remaining amount/progress/monthly saving, average recorded income, current-month category totals, and six monthly spending aggregates. Requests exclude account IDs, names, email addresses, passwords, JWTs, authentication credentials, goal descriptions, and raw transactions/expense descriptions from prompt data. `GEMINI_API_KEY` is read only by the Flask backend and passed to the Google SDK as provider authentication; it is never prompt content or exposed to React. Gemini is asked for schema-constrained JSON, which is validated before it is returned to the frontend.

FINTRACK uses Google Gemini through the backend for AI-assisted savings advice and financial goal planning. `gemini-3.5-flash-lite` is the default: Google lists it as a stable model and the Standard pricing table lists free input and output. `gemini-3.1-flash-lite` remains selectable with `GEMINI_MODEL`. Free-tier access depends on current availability, project eligibility and rate limits; it is not unlimited or guaranteed. Google states that free-tier content may be used to improve its products; review Google's current data-use terms before sending real financial information. The 3.5 model was manually exercised through both authenticated FINTRACK AI routes and returned schema-valid responses during local verification (September 2026). See Google's [Gemini 3.5 Flash-Lite model details](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [Gemini pricing and data-use information](https://ai.google.dev/gemini-api/docs/pricing), and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

The next-month expense forecast is a statistical calculation over the authenticated user's monthly expense totals. Gemini does not generate its number; generative AI recommendations are delivered separately by the savings-advice and goal-planning endpoints.

Do not use `database.db` as a production database. It is the checked-in legacy SQLite file, not the configured default database. The app does not create/alter production tables at startup; run `flask db upgrade` as a deployment step.

## Legacy expense import

Legacy rows are not migrated automatically. First run database migrations, register/sign up the account that should own the data, and obtain that account's numeric user ID from the authenticated `/api/auth/me` response. Then inspect the dry-run count before an intentional import:

```powershell
python scripts/import_legacy_expenses.py --source .\database.db --user-id 1 --dry-run
python scripts/import_legacy_expenses.py --source .\database.db --user-id 1
```

The source database is opened read-only. Rows are assigned the `Uncategorized` category, original date and amount are retained, and a source-row ledger prevents importing the same unchanged legacy row twice. Choose the account deliberately: all historical unowned expenses will become visible to that account. This operation writes only to the configured new database. After importing, sign into that account and check its expense list/dashboard totals against the dry-run row count and source totals before allowing normal use. Re-running the command reports already-imported rows and does not duplicate unchanged rows. Do not commit or overwrite the legacy database.

## API summary

All endpoints below `/api` except signup and login require `Authorization: Bearer <access_token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/signup` | Create account and issue access token |
| POST | `/auth/login` | Verify credentials and issue token |
| GET | `/auth/me` | Get authenticated account |
| POST | `/auth/logout` | Revoke current token |
| GET, POST | `/expenses` | List (optional `?month=YYYY-MM`) or add an expense |
| DELETE | `/expenses/<id>` | Delete own expense |
| GET, POST | `/income` | List or add one income record per month |
| PUT, DELETE | `/income/<id>` | Update or delete own income record |
| GET | `/dashboard` | Authenticated user's summary and history |
| GET | `/prediction/next-month` | Explainable recent-month average forecast |
| GET, POST | `/goals` | List or create goals |
| GET, PUT, DELETE | `/goals/<id>` | Read, update, or delete own goal |
| GET, POST | `/goals/<id>/contributions` | List or add own goal contribution |
| DELETE | `/goals/<id>/contributions/<contribution_id>` | Delete contribution and reverse its balance |
| POST | `/ai/savings-advice` | AI advice using authenticated dashboard data |
| POST | `/ai/goals/<id>/plan` | AI plan for an owned goal and financial data |

Money amounts are positive decimal values with at most two decimal places, except goal current amount, which may be zero. Income periods use `YYYY-MM`; dates use `YYYY-MM-DD`. Each income period is unique per account. Goal progress changes through recorded contributions; goal updates may set the current balance explicitly.

## Tests

Install development dependencies with `pip install -r requirements-dev.txt`, then run `python -m pytest`. Tests use a temporary SQLite database and do not touch the checked-in legacy database.

The application currently uses bearer JWTs with browser `sessionStorage` (the frontend behavior is documented in the root README). This keeps the token out of persistent local storage but does not protect it from same-origin script execution. Migrating to HttpOnly cookies is a separate coordinated security change requiring CSRF defenses and credentialed CORS. Before launch, review access-token lifetime/revocation retention and add a refresh-token lifecycle if sessions need to outlive the current token.
