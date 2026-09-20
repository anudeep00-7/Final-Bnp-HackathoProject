"""
reconciliation_service.py

Real reconciliation against the processing_reconciliation DB view.
"""
from decimal import Decimal
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session


def _d(v) -> Optional[Decimal]:
    return Decimal(str(v)) if v is not None else None


def get_reconciliation(
    db: Session,
    ca_id: Optional[str] = None,
    portfolio_id: Optional[str] = None,
    processing_id: Optional[int] = None,
    limit: int = 200,
) -> list:
    """
    Query the processing_reconciliation view and return structured results.

    View definition (V04_indexes_and_views.sql):
      SELECT
        processing_id, ca_id, portfolio_id, status,
        before_market_value + before_cash + before_receivable_value AS before_total,
        after_market_value  + after_cash  + after_receivable_value  AS after_total,
        (after_mv + after_cash + after_recv) - (before_mv + before_cash + before_recv) AS observed_difference,
        expected_leakage,
        reconciliation_difference
      FROM ca_processing
    """
    filters = []
    params: dict = {}

    if ca_id:
        filters.append("pr.ca_id = :ca_id")
        params["ca_id"] = ca_id
    if portfolio_id:
        filters.append("pr.portfolio_id = :portfolio_id")
        params["portfolio_id"] = portfolio_id
    if processing_id:
        filters.append("pr.processing_id = :processing_id")
        params["processing_id"] = processing_id

    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    sql = text(
        f"""
        SELECT pr.processing_id, pr.ca_id, pr.portfolio_id, pr.status,
               pr.before_total, pr.after_total, pr.observed_difference,
               pr.expected_leakage, pr.reconciliation_difference,
               cae.action_type,
               s.name AS security_name,
               s.symbol,
               p.portfolio_name,
               cp.created_at,
               cp.before_quantity,
               cp.after_quantity,
               cp.before_cash,
               cp.after_cash,
               cp.cash_movement,
               (al_res.processing_id IS NOT NULL) AS manually_resolved
        FROM corporate_actions.processing_reconciliation pr
        LEFT JOIN corporate_actions.ca_processing cp ON pr.processing_id = cp.processing_id
        LEFT JOIN corporate_actions.corporate_action_events cae ON pr.ca_id = cae.ca_id
        LEFT JOIN corporate_actions.securities s ON cae.security_id = s.security_id
        LEFT JOIN corporate_actions.portfolios p ON pr.portfolio_id = p.portfolio_id
        LEFT JOIN (
            SELECT DISTINCT processing_id FROM corporate_actions.audit_logs WHERE action = 'RECONCILIATION_RESOLVED'
        ) al_res ON pr.processing_id = al_res.processing_id
        {where}
        ORDER BY pr.processing_id DESC
        LIMIT :limit
        """
    )
    params["limit"] = limit

    rows = db.execute(sql, params).mappings().all()

    results = []
    for r in rows:
        obs_diff = _d(r["observed_difference"])
        exp_leak = _d(r["expected_leakage"])
        recon_diff = _d(r["reconciliation_difference"])

        # Determine reconciliation pass/fail
        # A zero or near-zero reconciliation_difference = clean
        if r["manually_resolved"]:
            passed = True
        elif recon_diff is not None:
            passed = abs(recon_diff) <= Decimal("0.000001")
        elif obs_diff is not None:
            leak = exp_leak if exp_leak is not None else Decimal("0")
            passed = abs(obs_diff - leak) <= Decimal("0.000001")
        else:
            passed = (r["status"] == "PROCESSED")

        results.append({
            "processing_id": r["processing_id"],
            "ca_id": r["ca_id"],
            "portfolio_id": r["portfolio_id"],
            "portfolio_name": r["portfolio_name"],
            "action_type": r["action_type"],
            "security_name": r["security_name"],
            "symbol": r["symbol"],
            "status": r["status"],
            "before_total": float(r["before_total"]) if r["before_total"] is not None else None,
            "after_total": float(r["after_total"]) if r["after_total"] is not None else None,
            "observed_difference": float(obs_diff) if obs_diff is not None else None,
            "expected_leakage": float(exp_leak) if exp_leak is not None else None,
            "reconciliation_difference": float(recon_diff) if recon_diff is not None else None,
            "before_quantity": float(r["before_quantity"]) if r["before_quantity"] is not None else 0.0,
            "after_quantity": float(r["after_quantity"]) if r["after_quantity"] is not None else 0.0,
            "before_cash": float(r["before_cash"]) if r["before_cash"] is not None else 0.0,
            "after_cash": float(r["after_cash"]) if r["after_cash"] is not None else 0.0,
            "cash_movement": float(r["cash_movement"]) if r["cash_movement"] is not None else 0.0,
            "processed_at": r["created_at"].isoformat() if r["created_at"] else None,
            "reconciled": passed,
        })
    return results


def compare(before_state: dict, after_state: dict) -> dict:
    """Simple field-level diff utility (retained for compatibility)."""
    changed = {k: {"before": before_state.get(k), "after": after_state.get(k)}
               for k in set(before_state) | set(after_state)
               if before_state.get(k) != after_state.get(k)}
    return {
        "matched": len(changed) == 0,
        "changes": changed,
        "before": before_state,
        "after": after_state,
    }