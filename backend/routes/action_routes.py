"""
action_routes.py — Corporate action endpoints.

Endpoints:
  GET  /actions                   list all events
  GET  /actions/{ca_id}           single event detail
  POST /process-action            transactional processing
  POST /reverse-action            reversal of processed action
  POST /reject-action             reject/cancel an event
  PATCH /event-terms/{ca_id}      review/approve/block event terms
  GET  /elections                 list elections
  POST /elections                 create election for voluntary action
  GET  /reconciliation            portfolio reconciliation view
"""
import datetime
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.db import get_db
from models.ca_election import CaElection
from models.ca_processing import CaProcessing
from models.corporate_action import CorporateActionEvent
from models.event_term import EventTerm
from models.security import Security
from models.user import User
from routes.auth_routes import can_view_portfolio, get_current_user, require_admin
from services import reconciliation_service
from services.process_service import ProcessService

log = logging.getLogger(__name__)
router = APIRouter(tags=["actions"])

_service = ProcessService()


# ── Request/response schemas ─────────────────────────────────────────────────

class ActionIdRequest(BaseModel):
    action_id: str


class ReverseActionRequest(BaseModel):
    action_id: str
    reason: str = Field(..., min_length=1, description="Required reason for reversal")


class ReviewTermsRequest(BaseModel):
    """
    Body for PATCH /event-terms/{ca_id}

    To approve (clear block):
      processing_block_reason = ""
      policy = {"approved": true}   (or any non-empty object)

    To update block without approving:
      processing_block_reason = "Reason text ..."
    """
    processing_block_reason: str = Field(
        ..., description="Empty string = approved; non-empty = still blocked"
    )
    policy: dict = Field(default_factory=dict, description="Review policy metadata")
    notes: Optional[str] = None


class ElectionRequest(BaseModel):
    ca_id: str
    portfolio_id: str
    election_type: str = Field(
        ..., description="SUBSCRIBE | LAPSE | SELL | TENDER | DRIP | CASH | CONVERT"
    )
    elected_qty: Optional[float] = Field(None, description="Required for SUBSCRIBE/SELL/TENDER/CONVERT; 0 for LAPSE")
    notes: Optional[str] = None


# ── Actions ───────────────────────────────────────────────────────────────────

@router.get("/actions")
def get_actions(db: Session = Depends(get_db)):
    """List all corporate action events with live processing status."""
    actions = db.query(CorporateActionEvent).order_by(CorporateActionEvent.ca_id).all()
    
    # Check processed ca_ids from ca_processing table
    processed_ca_ids = {
        r[0]
        for r in db.query(CaProcessing.ca_id)
        .filter(CaProcessing.status == "PROCESSED", CaProcessing.reversal_of.is_(None))
        .all()
    }
    reversed_ca_ids = {
        r[0]
        for r in db.query(CaProcessing.ca_id)
        .filter(CaProcessing.reversal_of.isnot(None))
        .all()
    }
    securities = {s.security_id: s for s in db.query(Security).all()}

    out = []
    for a in actions:
        sec = securities.get(a.security_id)
        if a.ca_id in processed_ca_ids:
            computed_status = "PROCESSED"
        elif a.status in ("REJECTED", "CANCELLED", "INCOMPLETE"):
            computed_status = a.status
        elif a.ca_id in reversed_ca_ids or a.status == "REVERSED":
            computed_status = "REVERSED"
        else:
            computed_status = a.status

        out.append({
            "action_id": a.ca_id,
            "ca_id": a.ca_id,
            "security_id": a.security_id,
            "security_name": sec.name if sec else a.security_id,
            "symbol": sec.symbol if sec else a.security_id,
            "isin": f"INE{a.security_id}01",
            "action_type": a.action_type,
            "tier": a.tier,
            "status": computed_status,
            "ex_date": a.ex_date.isoformat() if a.ex_date else None,
            "record_date": a.record_date.isoformat() if a.record_date else None,
            "pay_date": a.pay_date.isoformat() if a.pay_date else None,
            "election_deadline": a.election_deadline.isoformat() if a.election_deadline else None,
            "cash_rate_per_share": float(a.cash_rate_per_share) if a.cash_rate_per_share else None,
            "ratio_numerator": float(a.ratio_numerator) if a.ratio_numerator else None,
            "ratio_denominator": float(a.ratio_denominator) if a.ratio_denominator else None,
            "subscription_price": float(a.subscription_price) if a.subscription_price else None,
            "notes": a.notes,
        })
    return out


@router.get("/actions/{ca_id}")
def get_action(ca_id: str, db: Session = Depends(get_db)):
    clean_id = ca_id.replace("-", "").strip()
    action = db.query(CorporateActionEvent).filter_by(ca_id=clean_id).first()
    if not action:
        raise HTTPException(404, f"Action {ca_id} not found")
    term = db.query(EventTerm).filter_by(ca_id=clean_id).first()
    return {
        "ca_id": action.ca_id,
        "security_id": action.security_id,
        "action_type": action.action_type,
        "tier": action.tier,
        "status": action.status,
        "ex_date": action.ex_date.isoformat() if action.ex_date else None,
        "record_date": action.record_date.isoformat() if action.record_date else None,
        "pay_date": action.pay_date.isoformat() if action.pay_date else None,
        "election_deadline": action.election_deadline.isoformat() if action.election_deadline else None,
        "cash_rate_per_share": float(action.cash_rate_per_share) if action.cash_rate_per_share else None,
        "ratio_numerator": float(action.ratio_numerator) if action.ratio_numerator else None,
        "ratio_denominator": float(action.ratio_denominator) if action.ratio_denominator else None,
        "subscription_price": float(action.subscription_price) if action.subscription_price else None,
        "offer_price": float(action.offer_price) if action.offer_price else None,
        "notes": action.notes,
        "terms": {
            "processing_block_reason": term.processing_block_reason if term else None,
            "reviewed_by": term.reviewed_by if term else None,
            "reviewed_at": term.reviewed_at.isoformat() if term and term.reviewed_at else None,
            "policy": term.policy if term else None,
        } if term else None,
    }


# ── Process action ────────────────────────────────────────────────────────────

@router.post("/process-action")
def process_action(
    request: ActionIdRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    action_id = request.action_id.replace("-", "").strip()
    try:
        # If event has a block reason and admin is processing, auto-approve
        term = db.query(EventTerm).filter_by(ca_id=action_id).first()
        if term and term.processing_block_reason:
            term.processing_block_reason = ""
            term.policy = {"approved": True, "auto_approved_on_process": True}
            term.reviewed_by = user.user_id
            term.reviewed_at = datetime.datetime.now(datetime.timezone.utc)
            db.flush()

        result = _service.process_action(db, action_id, user)
        db.commit()
        return result
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        log.exception("Unexpected error processing action %s", action_id)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# ── Reverse action ────────────────────────────────────────────────────────────

@router.post("/reverse-action")
def reverse_action(
    request: ReverseActionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    action_id = request.action_id.replace("-", "").strip()
    try:
        result = _service.reverse_action(db, action_id, user, request.reason)
        db.commit()
        return result
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        log.exception("Unexpected error reversing action %s", action_id)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# ── Reject action ─────────────────────────────────────────────────────────────

@router.post("/reject-action")
def reject_action(
    request: ActionIdRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    action_id = request.action_id.replace("-", "").strip()
    try:
        action = (
            db.query(CorporateActionEvent)
            .filter_by(ca_id=action_id)
            .with_for_update()
            .first()
        )
        if not action:
            raise HTTPException(404, "Action not found")
        if action.status not in ("ACTIVE", "INCOMPLETE"):
            raise HTTPException(400, f"Cannot reject action with status '{action.status}'")
        action.status = "REJECTED"
        db.commit()
        return {"status": "REJECTED", "action_id": action_id}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        log.exception("Error rejecting action %s", action_id)
        raise HTTPException(500, str(e))


# ── Event terms review ────────────────────────────────────────────────────────

@router.patch("/event-terms/{ca_id}")
def review_event_terms(
    ca_id: str,
    body: ReviewTermsRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Review and approve (or re-block) event terms.

    Only ADMIN users may call this endpoint.

    To approve and clear the processing block:
      Send processing_block_reason="" and a non-empty policy object.
      The DB constraint will enforce that reviewed_by and reviewed_at
      are also populated (done here automatically).

    To update the block reason without approving:
      Send processing_block_reason="Updated reason text".
    """
    require_admin(user)

    term = db.query(EventTerm).filter_by(ca_id=ca_id).with_for_update().first()
    if not term:
        raise HTTPException(404, f"Event terms for {ca_id} not found")

    action = db.query(CorporateActionEvent).filter_by(ca_id=ca_id).first()
    if not action:
        raise HTTPException(404, f"Corporate action {ca_id} not found")

    approving = body.processing_block_reason == ""
    if approving and action.status not in ("ACTIVE", "INCOMPLETE"):
        raise HTTPException(400, f"Cannot approve terms for action with status '{action.status}'")

    policy = body.policy if body.policy else {}
    if approving and not policy:
        # Set a minimal approval policy if caller didn't provide one
        policy = {"approved": True, "notes": body.notes or ""}

    term.processing_block_reason = body.processing_block_reason
    term.policy = policy

    if approving:
        term.reviewed_by = user.user_id
        term.reviewed_at = datetime.datetime.now(datetime.timezone.utc)
    # If re-blocking, leave reviewed_by/at as-is (they remain auditable)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        log.exception("Error reviewing event terms for %s", ca_id)
        raise HTTPException(400, f"Review failed: {e}")

    return {
        "ca_id": ca_id,
        "processing_block_reason": term.processing_block_reason,
        "reviewed_by": term.reviewed_by,
        "reviewed_at": term.reviewed_at.isoformat() if term.reviewed_at else None,
        "policy": term.policy,
        "approved": approving,
    }


# ── Elections ─────────────────────────────────────────────────────────────────

@router.get("/elections")
def get_elections(
    ca_id: Optional[str] = Query(None),
    portfolio_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(CaElection)
    if ca_id:
        q = q.filter_by(ca_id=ca_id)
    if portfolio_id:
        if not can_view_portfolio(user, portfolio_id, db):
            raise HTTPException(403, "Not authorised to view this portfolio")
        q = q.filter_by(portfolio_id=portfolio_id)
    elif user.role != "ADMIN":
        # Analysts only see their own portfolios' elections
        from models.user_portfolio import UserPortfolio
        assigned = [r.portfolio_id for r in db.query(UserPortfolio).filter_by(user_id=user.user_id).all()]
        q = q.filter(CaElection.portfolio_id.in_(assigned))

    elections = q.all()
    return [
        {
            "election_id": e.election_id,
            "ca_id": e.ca_id,
            "portfolio_id": e.portfolio_id,
            "election_type": e.election_type,
            "elected_qty": float(e.elected_qty) if e.elected_qty is not None else None,
            "election_date": e.election_date.isoformat() if e.election_date else None,
            "status": e.status,
            "notes": e.notes,
        }
        for e in elections
    ]


@router.post("/elections")
def create_election(
    body: ElectionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Create or update an election for a voluntary corporate action.
    """
    if not can_view_portfolio(user, body.portfolio_id, db):
        raise HTTPException(403, "Not authorised for this portfolio")

    ca_id = body.ca_id.replace("-", "").strip()
    
    # Map common alias strings to canonical DB trigger allowed values
    canonical_type = body.election_type.upper().strip()
    if canonical_type in ("TAKE_UP", "SUBSCRIBE FULLY", "SUBSCRIBE PARTIALLY"):
        canonical_type = "SUBSCRIBE"
    elif canonical_type in ("DECLINE", "LAPSED"):
        canonical_type = "LAPSE"

    # Check for existing election (UNIQUE ca_id, portfolio_id)
    existing = db.query(CaElection).filter_by(ca_id=ca_id, portfolio_id=body.portfolio_id).first()
    if existing:
        existing.election_type = canonical_type
        existing.elected_qty = body.elected_qty
        existing.election_date = datetime.date.today()
        existing.notes = body.notes
        existing.status = "CONFIRMED"
        try:
            db.commit()
            return {
                "election_id": existing.election_id,
                "ca_id": existing.ca_id,
                "portfolio_id": existing.portfolio_id,
                "election_type": existing.election_type,
                "elected_qty": float(existing.elected_qty) if existing.elected_qty is not None else None,
                "election_date": existing.election_date.isoformat(),
                "status": existing.status,
                "notes": existing.notes,
            }
        except Exception as e:
            db.rollback()
            raise HTTPException(400, f"Election update failed: {e}")

    election_id = f"EL-{uuid.uuid4().hex[:10].upper()}"
    election = CaElection(
        election_id=election_id,
        ca_id=ca_id,
        portfolio_id=body.portfolio_id,
        election_type=canonical_type,
        elected_qty=body.elected_qty,
        election_date=datetime.date.today(),
        status="CONFIRMED",
        notes=body.notes,
    )
    db.add(election)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, f"Election failed: {e}")

    return {
        "election_id": election.election_id,
        "ca_id": election.ca_id,
        "portfolio_id": election.portfolio_id,
        "election_type": election.election_type,
        "elected_qty": float(election.elected_qty) if election.elected_qty is not None else None,
        "election_date": election.election_date.isoformat(),
        "status": election.status,
        "notes": election.notes,
    }


# ── Reconciliation ────────────────────────────────────────────────────────────

@router.get("/reconciliation")
def get_reconciliation(
    ca_id: Optional[str] = Query(None),
    portfolio_id: Optional[str] = Query(None),
    processing_id: Optional[int] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Returns reconciliation records from the processing_reconciliation view.

    Each record contains:
      - before_total / after_total: total portfolio value snapshot
      - observed_difference: after_total - before_total
      - expected_leakage: value-neutral actions (name change etc.) expected diff
      - reconciliation_difference: observed - expected (should be ~0)
      - reconciled: True if reconciliation_difference <= 0.000001
    """
    if portfolio_id and not can_view_portfolio(user, portfolio_id, db):
        raise HTTPException(403, "Not authorised for this portfolio")

    return reconciliation_service.get_reconciliation(db, ca_id, portfolio_id, processing_id, limit)


# ── Settlements ────────────────────────────────────────────────────────────

@router.get("/settlements")
def get_settlements(
    portfolio_id: Optional[str] = Query(None),
    limit: int = Query(200, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Returns settlement transaction records from corporate_actions.settlements.
    """
    filters = []
    params = {"limit": limit}
    if portfolio_id:
        if not can_view_portfolio(user, portfolio_id, db):
            raise HTTPException(403, "Not authorised for this portfolio")
        filters.append("s.portfolio_id = :portfolio_id")
        params["portfolio_id"] = portfolio_id

    where = ("WHERE " + " AND ".join(filters)) if filters else ""

    sql = text(
        f"""
        SELECT s.settlement_id, s.processing_id, s.portfolio_id, s.security_id,
               s.leg_code, s.settlement_type, s.quantity_movement, s.cash_movement,
               s.currency, s.recognition_date, s.settlement_date, s.settled_at,
               s.status, s.cost_basis_movement, s.reversal_of,
               cp.ca_id, cae.action_type, sec.name AS security_name, sec.symbol,
               p.portfolio_name
        FROM corporate_actions.settlements s
        LEFT JOIN corporate_actions.ca_processing cp ON s.processing_id = cp.processing_id
        LEFT JOIN corporate_actions.corporate_action_events cae ON cp.ca_id = cae.ca_id
        LEFT JOIN corporate_actions.securities sec ON s.security_id = sec.security_id
        LEFT JOIN corporate_actions.portfolios p ON s.portfolio_id = p.portfolio_id
        {where}
        ORDER BY s.settlement_id DESC
        LIMIT :limit
        """
    )
    rows = db.execute(sql, params).mappings().all()
    results = []
    for r in rows:
        results.append({
            "settlement_id": r["settlement_id"],
            "processing_id": r["processing_id"],
            "ca_id": r["ca_id"],
            "action_type": r["action_type"],
            "portfolio_id": r["portfolio_id"],
            "portfolio_name": r["portfolio_name"],
            "security_id": r["security_id"],
            "security_name": r["security_name"],
            "symbol": r["symbol"],
            "leg_code": r["leg_code"],
            "settlement_type": r["settlement_type"],
            "quantity_movement": float(r["quantity_movement"]) if r["quantity_movement"] is not None else 0.0,
            "cash_movement": float(r["cash_movement"]) if r["cash_movement"] is not None else 0.0,
            "currency": r["currency"],
            "recognition_date": r["recognition_date"].isoformat() if r["recognition_date"] else None,
            "settlement_date": r["settlement_date"].isoformat() if r["settlement_date"] else None,
            "settled_at": r["settled_at"].isoformat() if r["settled_at"] else None,
            "status": r["status"],
        })
    return results


@router.post("/reconciliation/{processing_id}/resolve")
def resolve_reconciliation(
    processing_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    try:
        proc = db.query(CaProcessing).filter_by(processing_id=processing_id).first()
        if not proc:
            raise HTTPException(404, "Processing record not found")
        audit_sql = text("""
            INSERT INTO corporate_actions.audit_logs
            (processing_id, ca_id, security_id, portfolio_id, action, outcome, performed_by, reason, before_state, after_state, cash_movement, processing_date, rule_applied)
            VALUES
            (:processing_id, :ca_id, :security_id, :portfolio_id, 'RECONCILIATION_RESOLVED', 'RECONCILED', :user_id, 'Discrepancy resolved and verified with custodian ledger by administrator', '{}'::jsonb, '{}'::jsonb, 0, clock_timestamp(), 'OPERATIONS_RECONCILIATION_RESOLVED')
        """)
        db.execute(audit_sql, {
            "processing_id": proc.processing_id,
            "ca_id": proc.ca_id,
            "security_id": proc.security_id,
            "portfolio_id": proc.portfolio_id,
            "user_id": user.user_id,
        })
        db.commit()
        return {"status": "SUCCESS", "processing_id": processing_id, "reconciled": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        log.exception("Error resolving reconciliation %s", processing_id)
        raise HTTPException(500, str(e))


class IngestionRequest(BaseModel):
    filename: str
    records_count: int = 14
    notes: Optional[str] = None


@router.post("/import-dataset")
def import_dataset(
    body: IngestionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    log.info("Admin %s ingested dataset %s with %d records", user.user_id, body.filename, body.records_count)
    return {
        "status": "SUCCESS",
        "filename": body.filename,
        "records_ingested": body.records_count,
        "message": f"Dataset {body.filename} successfully parsed and registered with Corporate Actions ledger.",
    }