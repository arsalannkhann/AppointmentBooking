#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# update.sh — Redeploy only backend or frontend (for CI/CD)
#
# Usage:
#   ./infrastructure/update.sh backend   # rebuild + redeploy API only
#   ./infrastructure/update.sh frontend  # rebuild + redeploy UI only
#   ./infrastructure/update.sh all       # both
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ID="${GCP_PROJECT:?Set GCP_PROJECT}"
REGION="${GCP_REGION:-us-central1}"
AR_REPO="meddent"
BACKEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/backend"
FRONTEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/frontend"

TARGET="${1:-all}"

BACKEND_URL=$(gcloud run services describe meddent-api \
  --region="${REGION}" --format="value(status.url)" 2>/dev/null || echo "")

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

if [[ "${TARGET}" == "backend" || "${TARGET}" == "all" ]]; then
  echo "→ Building & deploying backend..."
  docker build --platform linux/amd64 -t "${BACKEND_IMAGE}:latest" ./backend
  docker push "${BACKEND_IMAGE}:latest"
  gcloud run deploy meddent-api --image="${BACKEND_IMAGE}:latest" \
    --region="${REGION}" --quiet
  echo "✓ Backend updated"
fi

if [[ "${TARGET}" == "frontend" || "${TARGET}" == "all" ]]; then
  echo "→ Building & deploying frontend..."
  docker build \
    --platform linux/amd64 \
    --build-arg "NEXT_PUBLIC_API_URL=${BACKEND_URL}" \
    -t "${FRONTEND_IMAGE}:latest" ./frontend
  docker push "${FRONTEND_IMAGE}:latest"
  gcloud run deploy meddent-frontend --image="${FRONTEND_IMAGE}:latest" \
    --region="${REGION}" --quiet
  echo "✓ Frontend updated"
fi

echo "Done."
