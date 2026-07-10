# =============================================================================
# Dockerfile — AI Blood Dispatch Network (FastAPI backend)
# Multi-stage build: keeps the final image small (no build tools shipped).
#
# ASSUMPTION (confirm with Backend Lead): the FastAPI app's entrypoint is
# backend/main.py exposing `app = FastAPI(...)`, and dependencies live in
# backend/requirements.txt. Adjust paths below if the backend team structures
# things differently.
# =============================================================================

# ---- Stage 1: builder -------------------------------------------------------
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build deps only in this stage (not shipped to final image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend-requirements.txt
COPY database/requirements.txt ./database-requirements.txt

RUN pip install --no-cache-dir --user \
    -r backend-requirements.txt \
    -r database-requirements.txt

# ---- Stage 2: runtime --------------------------------------------------------
FROM python:3.11-slim AS runtime

WORKDIR /app

# Copy installed packages from the builder stage
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY backend/ ./backend/
COPY database/ ./database/

# Cloud Run / Render both inject PORT — default to 8000 for local runs
ENV PORT=8000
EXPOSE 8000

# Runs as a non-root user for basic container hygiene
RUN useradd --create-home appuser
USER appuser

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
