"""
audit_service.py

Reads and writes audit_logs in corporate_actions schema via SQLAlchemy.
All field names match the actual Supabase schema (V01_schema_and_tables.sql).

Schema reference:
  audit_id       bigint GENERATED ALWAYS AS IDENTITY
  processing_id  bigint
  ca_id          text
  security_id    text
  portfolio_id   text
  action         text   -- e.g. 'PROCESSING_INSERT', 'REVERSAL'
  outcome        text   -- mirrors ca_processing.status
  processing_date timestamptz
  rule_applied   text
  before_state   jsonb
  after_state    jsonb
  cash_movement  finite_numeric
  performed_by   text
  occurred_at    timestamptz
  reason         text
  reversal_of    bigint
"""

import json
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from models.audit_log import AuditLog

ALL_PORTFOLIOS = "ALL"   # sentinel for action-level (REJECTED/FAILED) records


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _clean(state: Optional[dict]) -> dict:
    """Make a dict JSON-safe."""
    out = {}
    for key, value in (state or {}).items():
        if isinstance(value, Decimal):
            value = float(value)
        elif isinstance(value, (date, datetime)):
            value = value.isoformat()
        out[key] = value
    return out


def _as_dict(value) -> dict:
    if isinstance(value, dict):
        return value
    try:
        return json.loads(value) if value else {}
    except (TypeError, ValueError):
        return {}


# ---------- access control ----------

def allowed_portfolios(user) -> Optional[set]:
    """None = Admin (sees everything). Otherwise the set of assigned portfolios."""
    role = getattr(user, "role", None) or user.get("role", "")
    if str(role).upper() == "ADMIN":
        return None
    # User model: check user_portfolios via relationship or just use role
    # For dict-style user (backwards compat):
    if isinstance(user, dict):
        raw = user.get("portfolio_id") or []
        if isinstance(raw, str):
            raw = raw.split(",")
        return {p.strip() for p in raw if p and p.strip()}
    # ORM User object — portfolios loaded lazily via query in route layer
    return None  # will be filtered in route if needed


def can_view(user, portfolio_id: str) -> bool:
    allowed = allowed_portfolios(user)
    return allowed is None or portfolio_id in allowed


# ---------- serialisation ----------

def serialize(row: AuditLog) -> dict:
    return {
        "audit_id": row.audit_id,
        "ca_id": row.ca_id,
        "security_id": row.security_id,
        "portfolio_id": row.portfolio_id,
        "action": row.action,
        "outcome": row.outcome,
        "processing_date": row.processing_date.isoformat() if row.processing_date else None,
        "rule_applied": row.rule_applied,
        "before_state": _as_dict(row.before_state),
        "after_state": _as_dict(row.after_state),
        "cash_movement": float(row.cash_movement) if row.cash_movement is not None else 0.0,
        "performed_by": row.performed_by,
        "occurred_at": row.occurred_at.isoformat() if row.occurred_at else None,
        "reason": row.reason,
        "reversal_of": row.reversal_of,
        # Legacy aliases so report_service / nl_query still work
        "action_id": row.ca_id,
        "timestamp": row.occurred_at.isoformat() if row.occurred_at else None,
    }


# ---------- reading ----------

def list_audit(db: Session, user, action_id: Optional[str] = None,
               portfolio_id: Optional[str] = None, limit: int = 500) -> list:
    q = db.query(AuditLog)

    # Role-based filtering
    role = getattr(user, "role", None) or (user.get("role") if isinstance(user, dict) else "ADMIN")
    if str(role).upper() != "ADMIN":
        # Analyst: restrict to their portfolios
        from models.user_portfolio import UserPortfolio
        user_id = getattr(user, "user_id", None) or (user.get("user_id") if isinstance(user, dict) else None)
        if user_id:
            assigned = [
                r.portfolio_id
                for r in db.query(UserPortfolio).filter_by(user_id=user_id).all()
            ]
            q = q.filter(AuditLog.portfolio_id.in_(assigned))

    if action_id:
        q = q.filter(AuditLog.ca_id == action_id)
    if portfolio_id:
        q = q.filter(AuditLog.portfolio_id == portfolio_id)

    rows = q.order_by(AuditLog.occurred_at.desc(), AuditLog.audit_id.desc()).limit(limit).all()
    return [serialize(r) for r in rows]


def audit_for_portfolio(db: Session, portfolio_id: str) -> list:
    """Oldest first. Used by report_service."""
    rows = (
        db.query(AuditLog)
        .filter(AuditLog.portfolio_id == portfolio_id)
        .order_by(AuditLog.occurred_at, AuditLog.audit_id)
        .all()
    )
    return [serialize(r) for r in rows]