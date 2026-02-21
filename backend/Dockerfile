# ── MedDent API — Cloud Run Dockerfile ────────────────────
FROM python:3.12-slim

# Security: non-root user
RUN addgroup --system api && adduser --system --ingroup api api

WORKDIR /app

# Install deps first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app/ ./app/

# Cloud Run sets PORT env var (default 8080)
ENV PORT=8080

USER api

# Use 1 worker per Cloud Run instance (Cloud Run scales instances, not workers)
CMD exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port ${PORT} \
    --workers 1 \
    --loop uvloop \
    --http h11
