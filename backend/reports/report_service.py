"""
report_service.py

Builds portfolio report data entirely from Supabase PostgreSQL.
No CSV files are read at runtime.

Field name notes vs old code:
  OLD                    NEW (actual DB schema)
  ---------              ---------
  CorporateAction        CorporateActionEvent
  action.action_id       action.ca_id
  action.payment_date    action.pay_date
  action.cash_rate       action.cash_rate_per_share
  action.ratio_num/den   action.ratio_numerator/denominator
  pos.quantity           pos.qty
  sec.security_name      sec.name
  pf.cash_balance        (removed — use cash_balances table)
"""

from collections import Counter
from datetime import date
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.corporate_action import CorporateActionEvent
from models.portfolio import Portfolio
from models.position import Position
from models.security import Security
from models.price import Price
from models.cash_balance import CashBalance
from services import audit_service


def _latest_price_map(db: Session, security_ids: list) -> dict:
    """Return {security_id: float(close_price)} for the most recent price of each security."""
    if not security_ids:
        return {}
    sub = (
        db.query(
            Price.security_id,
            func.max(Price.price_date).label("max_date"),
        )
        .filter(Price.security_id.in_(security_ids))
        .group_by(Price.security_id)
        .subquery()
    )
    rows = (
        db.query(Price)
        .join(
            sub,
            (Price.security_id == sub.c.security_id)
            & (Price.price_date == sub.c.max_date),
        )
        .all()
    )
    return {r.security_id: float(r.close_price) for r in rows}


def _latest_positions(db: Session, portfolio_id: str) -> list:
    """Return one Position per security (the row with the highest as_of_date)."""
    sub = (
        db.query(
            Position.portfolio_id,
            Position.security_id,
            func.max(Position.as_of_date).label("max_date"),
        )
        .filter(Position.portfolio_id == portfolio_id)
        .group_by(Position.portfolio_id, Position.security_id)
        .subquery()
    )
    return (
        db.query(Position)
        .join(
            sub,
            (Position.portfolio_id == sub.c.portfolio_id)
            & (Position.security_id == sub.c.security_id)
            & (Position.as_of_date == sub.c.max_date),
        )
        .all()
    )


def _latest_cash(db: Session, portfolio_id: str) -> float:
    """Return total cash across all currencies (no FX conversion — base currency assumed)."""
    sub = (
        db.query(
            CashBalance.portfolio_id,
            CashBalance.currency,
            func.max(CashBalance.as_of_date).label("max_date"),
        )
        .filter(CashBalance.portfolio_id == portfolio_id)
        .group_by(CashBalance.portfolio_id, CashBalance.currency)
        .subquery()
    )
    rows = (
        db.query(CashBalance)
        .join(
            sub,
            (CashBalance.portfolio_id == sub.c.portfolio_id)
            & (CashBalance.currency == sub.c.currency)
            & (CashBalance.as_of_date == sub.c.max_date),
        )
        .all()
    )
    return sum(float(r.balance) for r in rows)


def _estimate(action: CorporateActionEvent, pos: Position) -> dict:
    """Rough forecast for a pending action (only what the data allows)."""
    kind = (action.action_type or "").upper()
    rate = action.cash_rate_per_share
    num = action.ratio_numerator
    den = action.ratio_denominator
    cash = qty_change = None
    qty = float(pos.qty)
    if "DIVIDEND" in kind and "STOCK" not in kind and rate:
        cash = round(qty * float(rate), 2)
    elif "BONUS" in kind and num and den:
        qty_change = float(int(qty * float(num) / float(den)))
    elif "NAME" in kind:
        cash, qty_change = 0.0, 0.0
    return {
        "action_id": action.ca_id,
        "action_type": action.action_type,
        "security_id": action.security_id,
        "record_date": str(action.record_date or ""),
        "payment_date": str(action.pay_date or ""),
        "est_cash": cash,
        "est_qty_change": qty_change,
    }


def build_report_data(db: Session, portfolio_id: str) -> dict:
    pf = db.query(Portfolio).filter(Portfolio.portfolio_id == portfolio_id).first()
    if not pf:
        raise LookupError(f"Portfolio {portfolio_id} not found")

    positions = [p for p in _latest_positions(db, portfolio_id) if float(p.qty) > 0]
    sec_ids = [p.security_id for p in positions]
    securities = (
        {s.security_id: s for s in db.query(Security).filter(Security.security_id.in_(sec_ids)).all()}
        if sec_ids else {}
    )
    prices = _latest_price_map(db, sec_ids)

    holdings, cost_total, value_total, priced_cost = [], 0.0, 0.0, 0.0
    for p in positions:
        price = prices.get(p.security_id)
        qty = float(p.qty)
        avg = float(p.avg_cost)
        cost = qty * avg
        value = qty * price if price is not None else None
        sec = securities.get(p.security_id)
        holdings.append({
            "security_id": p.security_id,
            "name": sec.name if sec else p.security_id,
            "quantity": qty,
            "avg_cost": avg,
            "price": price,
            "cost": round(cost, 2),
            "market_value": round(value, 2) if value is not None else None,
            "pnl": round(value - cost, 2) if value is not None else None,
        })
        cost_total += cost
        if value is not None:
            value_total += value
            priced_cost += cost

    cash = _latest_cash(db, portfolio_id)
    total = value_total + cash
    allocation = [{"label": h["name"], "value": h["market_value"]}
                  for h in holdings if h["market_value"]]
    if cash > 0:
        allocation.append({"label": "Cash", "value": round(cash, 2)})
    for a in allocation:
        a["weight_pct"] = round(a["value"] / total * 100, 2) if total else 0.0

    # Past actions (from the actual audit trail)
    audit_rows = audit_service.audit_for_portfolio(db, portfolio_id)
    ca_ids = {r["ca_id"] for r in audit_rows if r.get("ca_id")}
    actions = (
        {a.ca_id: a for a in db.query(CorporateActionEvent)
         .filter(CorporateActionEvent.ca_id.in_(list(ca_ids))).all()}
        if ca_ids else {}
    )
    past = []
    for r in audit_rows:
        act = actions.get(r.get("ca_id") or r.get("action_id"))
        past.append({
            "date": (r.get("occurred_at") or r.get("timestamp") or "")[:10],
            "action_id": r.get("ca_id") or r.get("action_id"),
            "action_type": act.action_type if act else "",
            "security_id": act.security_id if act else r.get("security_id", ""),
            "qty_before": r["before_state"].get("qty"),
            "qty_after": r["after_state"].get("qty"),
            "cash_movement": r.get("cash_movement"),
            "rule_applied": r.get("rule_applied", ""),
        })

    # Future (pending) actions on securities this portfolio holds
    held = {p.security_id: p for p in positions}
    pending = (
        db.query(CorporateActionEvent)
        .filter(
            CorporateActionEvent.status == "ACTIVE",
            CorporateActionEvent.security_id.in_(list(held)),
        )
        .all()
    ) if held else []
    future = [_estimate(a, held[a.security_id]) for a in pending]

    data = {
        "portfolio_id": portfolio_id,
        "portfolio_name": pf.portfolio_name,
        "generated_on": date.today().isoformat(),
        "holdings": holdings,
        "totals": {
            "cost": round(cost_total, 2),
            "market_value": round(value_total, 2),
            "cash": round(cash, 2),
            "total_value": round(total, 2),
            "pnl": round(value_total - priced_cost, 2),
        },
        "allocation": allocation,
        "past_actions": past,
        "future_actions": future,
    }
    data["summary"] = build_summary(data)
    return data


def build_summary(data: dict) -> str:
    t = data["totals"]
    parts = [
        f"{data['portfolio_name']} holds {len(data['holdings'])} position(s) with a market value of "
        f"{t['market_value']:,.2f} and cash of {t['cash']:,.2f}, giving a total value of {t['total_value']:,.2f}."
    ]
    missing = [h["security_id"] for h in data["holdings"] if h["price"] is None]
    if missing:
        parts.append(f"No price was found for {', '.join(missing)}, so those positions are not valued.")

    past = data["past_actions"]
    if past:
        kinds = Counter(p["action_type"] or "unknown" for p in past)
        kinds_txt = ", ".join(f"{n} x {k}" for k, n in kinds.items())
        cash_in = sum(p["cash_movement"] or 0 for p in past)
        parts.append(
            f"{len(past)} corporate action adjustment(s) have been processed ({kinds_txt}), "
            f"with a net cash movement of {cash_in:,.2f}."
        )
    else:
        parts.append("No corporate actions have been processed for this portfolio yet.")

    future = data["future_actions"]
    if future:
        est_cash = sum(f["est_cash"] or 0 for f in future)
        nxt = min((f["record_date"] for f in future if f["record_date"]), default=None)
        parts.append(
            f"{len(future)} action(s) are pending"
            + (f", the next record date is {nxt}" if nxt else "")
            + f", with an expected cash inflow of {est_cash:,.2f}."
        )
    else:
        parts.append("There are no pending corporate actions.")
    return " ".join(parts)