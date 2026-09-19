import json
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from models.audit_log import AuditLog

ALL_PORTFOLIOS = "ALL"   # used for action-level records (REJECTED / FAILED)


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


# ---------- writing (called by Shailu's processors) ----------

def log_adjustment(db: Session, *, action_id: str, portfolio_id: str, rule_applied: str,
                   before_state: dict, after_state: dict, cash_movement: float = 0.0):
    """Add one audit row. Does NOT commit, so it lives in the same transaction
    as the position/cash update: both succeed or both roll back."""
    row = AuditLog(
        audit_id=f"AUD-{uuid.uuid4().hex[:12]}",
        action_id=action_id,
        portfolio_id=portfolio_id,
        before_state=_clean(before_state),
        after_state=_clean(after_state),
        rule_applied=rule_applied,
        cash_movement=float(cash_movement or 0),
        timestamp=_now(),
    )
    db.add(row)
    db.flush()
    return row


def log_outcome(db: Session, *, action_id: str, status: str, reason: str):
    """Audit row for a REJECTED or FAILED action (no portfolio numbers)."""
    return log_adjustment(
        db, action_id=action_id, portfolio_id=ALL_PORTFOLIOS,
        rule_applied=f"Action {status.lower()}",
        before_state={}, after_state={"status": status, "reason": reason}, cash_movement=0.0,
    )


# ---------- access control ----------

def allowed_portfolios(user: dict) -> Optional[set]:
    """None = Admin (sees everything). Otherwise the set of assigned portfolios."""
    if str(user.get("role", "")).upper() == "ADMIN":
        return None
    raw = user.get("portfolio_id") or []
    if isinstance(raw, str):
        raw = raw.split(",")
    return {p.strip() for p in raw if p and p.strip()}


def can_view(user: dict, portfolio_id: str) -> bool:
    allowed = allowed_portfolios(user)
    return allowed is None or portfolio_id in allowed


# ---------- reading ----------

def serialize(row: AuditLog) -> dict:
    return {
        "audit_id": row.audit_id,
        "action_id": row.action_id,
        "portfolio_id": row.portfolio_id,
        "before_state": _as_dict(row.before_state),
        "after_state": _as_dict(row.after_state),
        "rule_applied": row.rule_applied,
        "cash_movement": row.cash_movement,
        "timestamp": row.timestamp,
    }


def list_audit(db: Session, user: dict, action_id: Optional[str] = None,
               portfolio_id: Optional[str] = None, limit: int = 500) -> list:
    q = db.query(AuditLog)
    allowed = allowed_portfolios(user)
    if allowed is not None:
        q = q.filter(AuditLog.portfolio_id.in_(list(allowed)))
    if action_id:
        q = q.filter(AuditLog.action_id == action_id)
    if portfolio_id:
        q = q.filter(AuditLog.portfolio_id == portfolio_id)
    rows = q.order_by(AuditLog.timestamp.desc(), AuditLog.audit_id.desc()).limit(limit).all()
    return [serialize(r) for r in rows]


def audit_for_portfolio(db: Session, portfolio_id: str) -> list:
    """Oldest first. Used by reports."""
    rows = (db.query(AuditLog).filter(AuditLog.portfolio_id == portfolio_id)
            .order_by(AuditLog.timestamp, AuditLog.audit_id).all())
    return [serialize(r) for r in rows]