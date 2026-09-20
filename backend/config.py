import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")   # no default on purpose: no credentials in code
DATA_DIR = BASE_DIR / "data"

# ── Authentication configuration ─────────────────────────────────────────────
# ACTILEDGER_AUTH_MODE controls how the backend verifies caller identity.
#
# "development"  (default when env var absent)
#   → X-User-Id header is accepted at face value; falls back to DEMO_ADMIN.
#   → NEVER use in production.
#
# "production"
#   → Authorization: Bearer <JWT> is REQUIRED.
#   → SUPABASE_JWT_SECRET must also be set.
#   → Requests without a valid JWT receive HTTP 401.
#   → X-User-Id header is completely ignored.
#
AUTH_MODE = os.getenv("ACTILEDGER_AUTH_MODE", "development").lower()
IS_PRODUCTION_AUTH = AUTH_MODE == "production"

# Supabase JWT secret (HS256 shared secret from Supabase Dashboard → API → JWT Settings).
# Only required when AUTH_MODE=production.
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

# Front-end origins allowed by CORS.
# Comma-separated list, e.g. "http://localhost:3000,http://localhost:5173"
_CORS_ENV = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:8080,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174"
)
CORS_ORIGINS: list[str] = [o.strip() for o in _CORS_ENV.split(",") if o.strip()]