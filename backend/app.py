"""
app.py — FastAPI application entry point.

CORS:
  Configured for local frontend development origins defined in config.CORS_ORIGINS.
  Add ACTILEDGER_AUTH_MODE=production and CORS_ORIGINS=https://your-domain.com
  in production.
"""
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
from routes.auth_routes import router as auth_router
from routes.portfolio_routes import router as portfolio_router
from routes.action_routes import router as action_router
from routes.audit_routes import router as audit_router
from routes.report_routes import router as report_router

app = FastAPI(
    title="BNP Corporate Actions Hub",
    description="ActiLedger — corporate-action processing API",
    version="2.0.0",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(portfolio_router)
app.include_router(action_router)
app.include_router(audit_router)
app.include_router(report_router)


@app.get("/")
def home():
    return {
        "message": "BNP Corporate Actions Hub Running",
        "auth_mode": config.AUTH_MODE,
        "docs": "/docs",
    }