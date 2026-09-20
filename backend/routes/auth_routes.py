"""
auth_routes.py

Authentication + Authorization

Auth modes (controlled by ACTILEDGER_AUTH_MODE env var):

  development (default)
    X-User-Id header → lookup in users table
    Falls back to first ADMIN user when header absent
    ⚠️  NEVER use in production

  production
    Authorization: Bearer <Supabase JWT>
    JWT verified with SUPABASE_JWT_SECRET (HS256)
    JWT subject mapped to users.auth_subject
    No header → HTTP 401

Routes:
  POST /login    — looks up a user by user_id, returns user info (dev convenience)
  GET  /me       — returns current user info
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import config
from database.db import get_db
from models.user import User
from models.user_portfolio import UserPortfolio

log = logging.getLogger(__name__)
router = APIRouter(tags=["auth"])


# ── JWT verification helper ───────────────────────────────────────────────────

def _verify_jwt(token: str) -> dict:
    """
    Decode and verify a Supabase HS256 JWT.
    Returns the decoded payload on success; raises HTTPException on failure.
    Requires PyJWT: pip install PyJWT
    """
    try:
        import jwt as _jwt
        payload = _jwt.decode(
            token,
            config.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except Exception as exc:
        log.warning("JWT verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── get_current_user FastAPI dependency ──────────────────────────────────────

def get_current_user(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency that resolves the calling user.

    PRODUCTION mode  (ACTILEDGER_AUTH_MODE=production):
      Requires Authorization: Bearer <JWT>.
      Maps JWT sub claim to users.auth_subject.
      HTTP 401 if token absent or invalid.

    DEVELOPMENT mode (default):
      Reads X-User-Id header.
      Falls back to the first ADMIN user when header is absent.
      ⚠️  This bypass is intentional and clearly logged.
    """
    if config.IS_PRODUCTION_AUTH:
        # --- PRODUCTION: require valid JWT ---
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Authorization header required")
        token = authorization.removeprefix("Bearer ").strip()
        if not config.SUPABASE_JWT_SECRET:
            raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET not configured")
        payload = _verify_jwt(token)
        subject = payload.get("sub")
        if not subject:
            raise HTTPException(status_code=401, detail="JWT missing sub claim")
        user = db.query(User).filter_by(auth_subject=subject, is_active=True).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found for JWT subject")
        return user

    else:
        # --- DEVELOPMENT: X-User-Id header with DEMO_ADMIN fallback ---
        if x_user_id:
            user = db.query(User).filter_by(user_id=x_user_id, is_active=True).first()
            if user:
                return user
            # If user not found, fall back to first ADMIN (dev mode convenience)
            log.debug(f"User '{x_user_id}' not found; falling back to first ADMIN (DEV mode)")
            user = db.query(User).filter_by(role="ADMIN", is_active=True).first()
            if not user:
                raise HTTPException(status_code=401, detail="No admin user available for dev fallback")
            return user
        # Explicit fallback — only in development mode
        log.debug("No X-User-Id header; using first ADMIN (DEV mode)")
        user = db.query(User).filter_by(role="ADMIN", is_active=True).first()
        if not user:
            raise HTTPException(status_code=401, detail="No admin user available for dev fallback")
        return user


# ── Portfolio access helper ───────────────────────────────────────────────────

def can_view_portfolio(user: User, portfolio_id: str, db: Session) -> bool:
    """Return True if the user may access the given portfolio."""
    if user.role == "ADMIN":
        return True
    return db.query(UserPortfolio).filter_by(
        user_id=user.user_id, portfolio_id=portfolio_id
    ).first() is not None


def require_admin(user: User) -> User:
    """Raise 403 if user is not ADMIN."""
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


# ── Routes ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    user_id: str


def _user_portfolios(user: User, db: Session) -> list:
    if user.role == "ADMIN":
        return ["ALL"]
    return [r.portfolio_id for r in db.query(UserPortfolio).filter_by(user_id=user.user_id).all()]


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Development convenience: look up a user by user_id and return their info."""
    user = db.query(User).filter_by(user_id=body.user_id, is_active=True).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{body.user_id}' not found")
    return {
        "user_id": user.user_id,
        "display_name": user.display_name,
        "role": user.role,
        "portfolios": _user_portfolios(user, db),
        "auth_mode": config.AUTH_MODE,
        "note": "Dev stub. JWT auth required in production mode.",
    }


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {
        "user_id": user.user_id,
        "display_name": user.display_name,
        "role": user.role,
        "is_active": user.is_active,
        "portfolios": _user_portfolios(user, db),
        "auth_mode": config.AUTH_MODE,
    }