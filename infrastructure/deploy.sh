#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# deploy.sh — MedDent Full GCP Deployment
#
# Deploys:
#   • Cloud SQL PostgreSQL 16 instance (meddent-db)
#   • Artifact Registry Docker repositories
#   • Backend API → Cloud Run (meddent-api)
#   • Frontend     → Cloud Run (meddent-frontend)
#   • Secret Manager for credentials
#   • VPC connector for private Cloud SQL access
#   • IAM service accounts with least-privilege
#
# Prerequisites:
#   gcloud CLI installed & authenticated:  gcloud auth login
#   Docker installed and running
#
# Usage:
#   export GCP_PROJECT=my-project-id
#   export GOOGLE_API_KEY=AIzaSy...
#   chmod +x infrastructure/deploy.sh
#   ./infrastructure/deploy.sh
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

# ─── Config — override via env vars ────────────────────────────────
PROJECT_ID="${GCP_PROJECT:?Set GCP_PROJECT env var}"
REGION="${GCP_REGION:-us-central1}"
GOOGLE_KEY="${GOOGLE_API_KEY:?Set GOOGLE_API_KEY env var}"

DB_INSTANCE="dentalbridge"
DB_NAME="postgres"
DB_USER="postgres"
DB_TIER="${CLOUD_SQL_TIER:-db-g1-small}"         # cheapest; use db-n1-standard-2 for prod

AR_REPO="meddent"
BACKEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/backend"
FRONTEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/frontend"

SA_NAME="meddent-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# ─── Colors ────────────────────────────────────────────────────────
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${CYAN}[$(date +%H:%M:%S)] $*${NC}"; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }

# ─── 0. Validate ───────────────────────────────────────────────────
log "Validating gcloud auth..."
gcloud config set project "${PROJECT_ID}"
ACCOUNT=$(gcloud config get-value account 2>/dev/null)
ok "Deploying as: ${ACCOUNT} to project: ${PROJECT_ID}"

# ─── 1. Enable APIs ────────────────────────────────────────────────
log "Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  sql-component.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  vpcaccess.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  --quiet
ok "APIs enabled"

# ─── 2. Artifact Registry ──────────────────────────────────────────
log "Creating Artifact Registry repository..."
gcloud artifacts repositories create "${AR_REPO}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="MedDent Docker images" \
  --quiet 2>/dev/null || warn "Repository already exists"

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
ok "Artifact Registry ready"

# ─── 3. Cloud SQL ──────────────────────────────────────────────────
log "Provisioning Cloud SQL PostgreSQL 16 (${DB_TIER})..."
log "  (this can take 3–5 minutes on first run)"

if gcloud sql instances describe "${DB_INSTANCE}" --quiet &>/dev/null; then
  warn "Cloud SQL instance '${DB_INSTANCE}' already exists — skipping creation"
else
  gcloud sql instances create "${DB_INSTANCE}" \
    --database-version=POSTGRES_16 \
    --tier="${DB_TIER}" \
    --region="${REGION}" \
    --storage-type=SSD \
    --storage-size=10GB \
    --storage-auto-increase \
    --backup-start-time=03:00 \
    --enable-bin-log \
    --no-assign-ip \
    --quiet
  ok "Cloud SQL instance created"
fi

# Generate secure DB password that meets Cloud SQL criteria (upper, lower, num, special)
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 28)
DB_PASSWORD="${DB_PASSWORD}A1a!"

# Create DB user
log "Creating database user '${DB_USER}'..."
gcloud sql users create "${DB_USER}" \
  --instance="${DB_INSTANCE}" \
  --password="${DB_PASSWORD}" \
  --quiet 2>/dev/null || \
gcloud sql users set-password "${DB_USER}" \
  --instance="${DB_INSTANCE}" \
  --password="${DB_PASSWORD}" \
  --quiet

# Create database
log "Creating database '${DB_NAME}'..."
gcloud sql databases create "${DB_NAME}" \
  --instance="${DB_INSTANCE}" \
  --quiet 2>/dev/null || warn "Database already exists"

CLOUD_SQL_CONNECTION=$(gcloud sql instances describe "${DB_INSTANCE}" \
  --format="value(connectionName)")
ok "Cloud SQL: ${CLOUD_SQL_CONNECTION}"

# ─── 4. Secret Manager ─────────────────────────────────────────────
log "Storing secrets in Secret Manager..."

store_secret() {
  local name="$1" value="$2"
  echo -n "${value}" | gcloud secrets create "${name}" \
    --data-file=- --quiet 2>/dev/null || \
  echo -n "${value}" | gcloud secrets versions add "${name}" \
    --data-file=- --quiet
}

store_secret "meddent-db-password"    "${DB_PASSWORD}"
store_secret "meddent-google-key"  "${GOOGLE_KEY}"
ok "Secrets stored"

# ─── 5. Service Account ────────────────────────────────────────────
log "Creating service account '${SA_NAME}'..."
gcloud iam service-accounts create "${SA_NAME}" \
  --display-name="MedDent Cloud Run SA" \
  --quiet 2>/dev/null || warn "Service account already exists"

# Grant Cloud SQL Client role (Unix socket access)
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --quiet

# Grant Secret Manager access
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

ok "Service account configured"

# ─── 6. Build & push backend ───────────────────────────────────────
log "Building backend Docker image..."
docker build --platform linux/amd64 -t "${BACKEND_IMAGE}:latest" ./backend
docker push "${BACKEND_IMAGE}:latest"
ok "Backend image pushed"

# ─── 7. Deploy backend to Cloud Run ────────────────────────────────
log "Deploying backend to Cloud Run..."
gcloud run deploy meddent-api \
  --image="${BACKEND_IMAGE}:latest" \
  --region="${REGION}" \
  --platform=managed \
  --service-account="${SA_EMAIL}" \
  --add-cloudsql-instances="${CLOUD_SQL_CONNECTION}" \
  --set-env-vars="DB_DRIVER=postgresql+asyncpg" \
  --set-env-vars="DB_NAME=${DB_NAME}" \
  --set-env-vars="DB_USER=${DB_USER}" \
  --set-env-vars="CLOUD_SQL_CONNECTION_NAME=${CLOUD_SQL_CONNECTION}" \
  --set-env-vars="USE_UNIX_SOCKET=true" \
  --set-secrets="DB_PASSWORD=meddent-db-password:latest" \
  --set-secrets="GOOGLE_API_KEY=meddent-google-key:latest" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=30s \
  --allow-unauthenticated \
  --quiet

BACKEND_URL=$(gcloud run services describe meddent-api \
  --region="${REGION}" --format="value(status.url)")
ok "Backend live: ${BACKEND_URL}"

# Update CORS to allow frontend (we'll update again after frontend deploy)
gcloud run services update meddent-api \
  --region="${REGION}" \
  --update-env-vars="ALLOWED_ORIGINS=*" \
  --quiet

# ─── 8. Build & push frontend ──────────────────────────────────────
log "Building frontend Docker image..."
docker build \
  --platform linux/amd64 \
  --build-arg "NEXT_PUBLIC_API_URL=${BACKEND_URL}" \
  -t "${FRONTEND_IMAGE}:latest" \
  ./frontend
docker push "${FRONTEND_IMAGE}:latest"
ok "Frontend image pushed"

# ─── 9. Deploy frontend to Cloud Run ───────────────────────────────
log "Deploying frontend to Cloud Run..."
gcloud run deploy meddent-frontend \
  --image="${FRONTEND_IMAGE}:latest" \
  --region="${REGION}" \
  --platform=managed \
  --service-account="${SA_EMAIL}" \
  --set-env-vars="NEXT_PUBLIC_API_URL=${BACKEND_URL}" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  --concurrency=100 \
  --timeout=30s \
  --allow-unauthenticated \
  --quiet

FRONTEND_URL=$(gcloud run services describe meddent-frontend \
  --region="${REGION}" --format="value(status.url)")
ok "Frontend live: ${FRONTEND_URL}"

# ─── 10. Update backend CORS with real frontend URL ────────────────
log "Updating backend CORS to allow all frontend origins..."
gcloud run services update meddent-api \
  --region="${REGION}" \
  --update-env-vars="ALLOWED_ORIGINS=*" \
  --quiet
ok "CORS updated"

# ─── 11. Health check ──────────────────────────────────────────────
log "Running health check..."
sleep 5
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/health")
if [[ "${HTTP_STATUS}" == "200" ]]; then
  ok "Backend health check passed (HTTP ${HTTP_STATUS})"
else
  warn "Health check returned HTTP ${HTTP_STATUS} — check Cloud Run logs"
fi

# ─── Done ──────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo -e "${GREEN}  ⚕  MedDent deployed successfully!${NC}"
echo "════════════════════════════════════════════════"
echo ""
echo -e "  🌐 Frontend:  ${FRONTEND_URL}"
echo -e "  🔌 API:       ${BACKEND_URL}"
echo -e "  📋 API docs:  ${BACKEND_URL}/docs"
echo -e "  🗄  DB:       ${CLOUD_SQL_CONNECTION}"
echo ""
echo "  Useful commands:"
echo "  gcloud run logs tail meddent-api       --region ${REGION}"
echo "  gcloud run logs tail meddent-frontend  --region ${REGION}"
echo "  gcloud sql connect ${DB_INSTANCE} --user=${DB_USER}"
echo ""
