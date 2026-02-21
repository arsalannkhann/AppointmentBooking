# ⚕ MedDent — TypeScript + Cloud Run + Cloud SQL

Production dental appointment booking system with AI-powered assistant.

```
┌─────────────────────────────────────────────────────────────┐
│                     Google Cloud Platform                    │
│                                                             │
│  ┌─────────────────┐       ┌─────────────────────────────┐  │
│  │  Cloud Run      │       │  Cloud Run                  │  │
│  │  meddent-frontend│──────▶│  meddent-api               │  │
│  │  Next.js 14 TS  │  HTTP │  FastAPI + asyncpg          │  │
│  └─────────────────┘       └──────────┬──────────────────┘  │
│                                       │ Unix socket          │
│                             ┌─────────▼──────────────────┐  │
│                             │  Cloud SQL                  │  │
│                             │  PostgreSQL 16              │  │
│                             │  (private IP / no public)  │  │
│                             └────────────────────────────┘  │
│                                                             │
│  Secret Manager: DB_PASSWORD, GOOGLE_API_KEY               │
│  Artifact Registry: Docker images                           │
│  IAM: meddent-runner service account                        │
└─────────────────────────────────────────────────────────────┘
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.12, asyncpg |
| Database | Cloud SQL PostgreSQL 16 (async SQLAlchemy) |
| AI | Claude claude-sonnet-4 via Anthropic SDK |
| Compute | Google Cloud Run (serverless, scales to 0) |
| Images | Artifact Registry |
| Secrets | Secret Manager |
| Local DB | Docker Compose PostgreSQL or SQLite fallback |

---

## Project Structure

```
dental-booking/
├── frontend/                     # Next.js TypeScript app
│   ├── src/
│   │   ├── app/                  # Next.js App Router
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx          # Shell + routing
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── chat/             # ChatPage, BookingConfirmCard
│   │   │   ├── calendar/         # CalendarPage (Gantt view)
│   │   │   ├── doctors/          # DoctorsPage + live slot finder
│   │   │   ├── admin/            # AdminPage + manual booking
│   │   │   └── ui/               # Sidebar
│   │   ├── lib/
│   │   │   └── api-client.ts     # Typed fetch client
│   │   └── types/
│   │       └── index.ts          # All TypeScript types
│   ├── Dockerfile                # Multi-stage Cloud Run build
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── next.config.js
│
├── backend/                      # FastAPI Python service
│   ├── app/
│   │   ├── main.py               # FastAPI app + lifespan
│   │   ├── database.py           # Cloud SQL + SQLAlchemy async
│   │   ├── models.py             # ORM: Appointment, ChatSession, ChatMessage
│   │   ├── schemas.py            # Pydantic v2 request/response
│   │   ├── data_model.py         # Static clinics/doctors/procedures
│   │   ├── seed.py               # Auto-seed on empty DB
│   │   └── routers/
│   │       ├── appointments.py   # CRUD endpoints
│   │       ├── data.py           # Static data endpoints
│   │       ├── slots.py          # Conflict-aware slot finder
│   │       └── chat.py           # Claude AI + session persistence
│   ├── Dockerfile                # Cloud Run optimised
│   ├── requirements.txt
│   └── .env.example
│
├── infrastructure/
│   ├── deploy.sh                 # Full GCP deploy (one command)
│   └── update.sh                 # Redeploy backend or frontend
│
├── docker-compose.yml            # Local full-stack dev
└── README.md
```

---

## Quick Start — Local Development

### Option A: Docker Compose (recommended, full PostgreSQL stack)

```bash
# 1. Clone / unzip project
cd dental-booking

# 2. Set your API key
echo "GOOGLE_API_KEY=AIzaSy..." > .env

# 3. Start everything (DB + backend + frontend)
docker compose up --build

# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API docs (Swagger): http://localhost:8000/docs
```

### Option B: Manual local dev (hot reload)

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Use SQLite (no Postgres needed)
export DB_DRIVER=sqlite+aiosqlite
export GOOGLE_API_KEY=AIzaSy...

uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
# → http://localhost:3000
```

---

## GCP Deployment (Cloud Run + Cloud SQL)

### Prerequisites

```bash
# Install gcloud CLI
brew install google-cloud-sdk    # macOS
# or: https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login
gcloud auth application-default login

# Create a GCP project (or use existing)
gcloud projects create meddent-prod --name="MedDent Prod"
gcloud billing projects link meddent-prod --billing-account=YOUR_BILLING_ACCOUNT
```

### One-command deploy

```bash
export GCP_PROJECT=meddent-prod
export GOOGLE_API_KEY=AIzaSy...
export GCP_REGION=us-central1    # optional, default us-central1

chmod +x infrastructure/deploy.sh
./infrastructure/deploy.sh
```

**What the script does (fully automated):**

1. ✅ Enables all required APIs (Cloud Run, Cloud SQL, Artifact Registry, Secret Manager, IAM)
2. ✅ Creates Artifact Registry repository for Docker images
3. ✅ Provisions Cloud SQL PostgreSQL 16 instance (private IP, no public endpoint)
4. ✅ Generates secure random DB password, creates user + database
5. ✅ Stores `DB_PASSWORD` and `GOOGLE_API_KEY` in Secret Manager
6. ✅ Creates IAM service account with `cloudsql.client` + `secretAccessor` roles only
7. ✅ Builds & pushes backend Docker image with Cloud SQL Auth Proxy socket support
8. ✅ Deploys backend to Cloud Run with Unix socket Cloud SQL connection, secrets injected
9. ✅ Builds & pushes frontend with correct `NEXT_PUBLIC_API_URL` baked in
10. ✅ Deploys frontend to Cloud Run
11. ✅ Updates backend CORS to allow only the frontend URL
12. ✅ Health check verification

**Output:**
```
════════════════════════════════════════
  ⚕  MedDent deployed successfully!
════════════════════════════════════════

  🌐 Frontend:  https://meddent-frontend-lrlvype7ma-uc.a.run.app
  🔌 API:       https://meddent-api-lrlvype7ma-uc.a.run.app
  📋 API docs:  https://meddent-api-lrlvype7ma-uc.a.run.app/docs
  🗄  DB:       salesos-473014:us-central1:dentalbridge
```

### Database IP Details

- **Connection Name:** `salesos-473014:us-central1:dentalbridge`
- **Private IP Connectivity:** Disabled
- **Public IP Connectivity:** Enabled
- **Public IP Address:** `34.134.104.207`
- **Outgoing IP Address:** `34.59.128.189`

### Redeployment (CI/CD)

```bash
# Redeploy only backend (e.g., after Python changes)
export GCP_PROJECT=meddent-prod
./infrastructure/update.sh backend

# Redeploy only frontend (e.g., after UI changes)
./infrastructure/update.sh frontend

# Both
./infrastructure/update.sh all
```

### GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloud Run
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA_EMAIL }}

      - name: Deploy
        run: |
          export GCP_PROJECT=${{ secrets.GCP_PROJECT }}
          ./infrastructure/update.sh all
```

---

## Cloud SQL Connection Modes

| Mode | When to use | Config |
|------|------------|--------|
| Unix socket (Cloud SQL Auth Proxy) | Cloud Run (recommended) | `USE_UNIX_SOCKET=true` + `CLOUD_SQL_CONNECTION_NAME` |
| TCP via Cloud SQL Auth Proxy | Local dev | `DB_HOST=127.0.0.1`, run `cloud_sql_proxy` |
| Private IP (VPC) | GKE / VMs | `DB_HOST=<private-ip>` |
| SQLite | Local dev without any DB | `DB_DRIVER=sqlite+aiosqlite` |

### Connect to Cloud SQL locally (for debugging)

```bash
# Download Cloud SQL Auth Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.4/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

# Run proxy (keep running in background)
./cloud-sql-proxy salesos-473014:us-central1:dentalbridge

# Connect with psql using the app's secure generated password:
PGPASSWORD=$(gcloud secrets versions access latest --secret=meddent-db-password) \
  psql -h 127.0.0.1 -U meddent_app -d bronn

# OR Connect if you reset the password via the Google Cloud Console UI:
# (The console UI resets the default 'postgres' user, not the app user!)
psql -h 127.0.0.1 -U postgres -d postgres
# (Enter your custom password when prompted)
```

---

## Environment Variables Reference

### Backend (Cloud Run env vars)

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | ✅ | Gemini API key (from Secret Manager) |
| `DB_PASSWORD` | ✅ | PostgreSQL password (from Secret Manager) |
| `DB_DRIVER` | ✅ | `postgresql+asyncpg` or `sqlite+aiosqlite` |
| `DB_NAME` | ✅ | Database name (default: `bronn`) |
| `DB_USER` | ✅ | Database user |
| `CLOUD_SQL_CONNECTION_NAME` | ✅ Cloud Run | `project:region:instance` |
| `USE_UNIX_SOCKET` | Cloud Run | `true` for Cloud Run |
| `DB_HOST` | Local | `127.0.0.1` for proxy |
| `DB_PORT` | Local | `5432` |
| `ALLOWED_ORIGINS` | ✅ | Frontend URL for CORS |

### Frontend (Cloud Run env vars + Next.js build args)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend URL (baked into build AND runtime) |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/data/clinics` | List clinics |
| GET | `/api/data/doctors` | List doctors |
| GET | `/api/data/procedures` | List procedures |
| GET | `/api/slots?procedure_id=...` | Find available slots |
| GET | `/api/appointments` | List appointments |
| GET | `/api/appointments/week?week_start=...&week_end=...` | Week view |
| GET | `/api/appointments/stats` | Stats |
| POST | `/api/appointments` | Create appointment |
| PATCH | `/api/appointments/{id}/status` | Update status |
| DELETE | `/api/appointments/{id}` | Cancel |
| POST | `/api/chat` | Send message to ARIA |
| POST | `/api/chat/confirm` | Confirm and persist booking |

Full interactive docs: `{BACKEND_URL}/docs`

---

## Cost Estimate (GCP)

| Resource | Tier | Est. Monthly Cost |
|----------|------|-------------------|
| Cloud Run (backend) | 0.5 vCPU, 512MB, ~1k req/day | ~$0–5 |
| Cloud Run (frontend) | 0.5 vCPU, 512MB | ~$0–3 |
| Cloud SQL | `db-g1-small`, 10GB SSD | ~$20–25 |
| Artifact Registry | <1GB storage | ~$0.10 |
| Secret Manager | 2 secrets | ~$0 |
| **Total** | | **~$25–35/month** |

Upgrade Cloud SQL to `db-n1-standard-2` (~$90/mo) for production workloads.
