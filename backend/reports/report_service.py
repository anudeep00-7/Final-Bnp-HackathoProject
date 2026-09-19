from collections import Counter
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from models.corporate_action import CorporateAction
from models.portfolio import Portfolio
from models.position import Position
from models.security import Security
from services import audit_service

PRICES_CSV = Path(__file__).resolve().parents[1] / "data" / "prices.csv"


@lru_cache(maxsize=1)
def _prices() -> pd.DataFrame:
    df = pd.read_csv(PRICES_CSV)
    df["price_date"] = pd.to_datetime(df["price_date"], errors="coerce")
    return df.dropna(subset=["price_date"]).sort_values("price_date")


def latest_price(security_id: str, as_of: Optional[date] = None) -> Optional[float]:
    df = _prices()
    df = df[df["security_id"] == security_id]
    if as_of:
        df = df[df["price_date"] <= pd.Timestamp(as_of)]
    return float(df.iloc[-1]["close_price"]) if not df.empty else None


def _estimate(action, pos) -> dict:
    """Rough forecast for a pending action (only what the data allows)."""
    kind = (action.action_type or "").upper()
    rate = getattr(action, "cash_rate", None)
    num, den = getattr(action, "ratio_num", None), getattr(action, "ratio_den", None)
    cash = qty_change = None
    if "DIVIDEND" in kind and "STOCK" not in kind and rate:
        cash = round(pos.quantity * float(rate), 2)
    elif "BONUS" in kind and num and den:
        qty_change = float(int(pos.quantity * float(num) / float(den)))   # whole shares
    elif "NAME" in kind:
        cash, qty_change = 0.0, 0.0
    return {
        "action_id": action.action_id, "action_type": action.action_type,
        "security_id": action.security_id,
        "record_date": str(getattr(action, "record_date", "") or ""),
        "payment_date": str(getattr(action, "payment_date", "") or ""),
        "est_cash": cash, "est_qty_change": qty_change,
    }


def build_report_data(db: Session, portfolio_id: str) -> dict:
    pf = db.query(Portfolio).filter(Portfolio.portfolio_id == portfolio_id).first()
    if not pf:
        raise LookupError(f"Portfolio {portfolio_id} not found")

    positions = [p for p in db.query(Position).filter(Position.portfolio_id == portfolio_id).all()
                 if p.quantity and p.quantity > 0]
    sec_ids = [p.security_id for p in positions]
    securities = {s.security_id: s for s in
                  db.query(Security).filter(Security.security_id.in_(sec_ids)).all()} if sec_ids else {}

    holdings, cost_total, value_total, priced_cost = [], 0.0, 0.0, 0.0
    for p in positions:
        price = latest_price(p.security_id)
        cost = p.quantity * p.avg_cost
        value = p.quantity * price if price is not None else None
        sec = securities.get(p.security_id)
        holdings.append({
            "security_id": p.security_id,
            "name": sec.security_name if sec else p.security_id,
            "quantity": p.quantity, "avg_cost": p.avg_cost, "price": price,
            "cost": round(cost, 2),
            "market_value": round(value, 2) if value is not None else None,
            "pnl": round(value - cost, 2) if value is not None else None,
        })
        cost_total += cost
        if value is not None:
            value_total += value
            priced_cost += cost

    cash = float(pf.cash_balance or 0)
    total = value_total + cash
    allocation = [{"label": h["name"], "value": h["market_value"]}
                  for h in holdings if h["market_value"]]
    if cash > 0:
        allocation.append({"label": "Cash", "value": round(cash, 2)})
    for a in allocation:
        a["weight_pct"] = round(a["value"] / total * 100, 2) if total else 0.0

    # past actions (from the audit trail)
    audit_rows = audit_service.audit_for_portfolio(db, portfolio_id)
    ids = {r["action_id"] for r in audit_rows}
    actions = {a.action_id: a for a in db.query(CorporateAction)
               .filter(CorporateAction.action_id.in_(list(ids))).all()} if ids else {}
    past = []
    for r in audit_rows:
        act = actions.get(r["action_id"])
        past.append({
            "date": r["timestamp"][:10], "action_id": r["action_id"],
            "action_type": act.action_type if act else "",
            "security_id": act.security_id if act else r["before_state"].get("security_id", ""),
            "qty_before": r["before_state"].get("quantity"),
            "qty_after": r["after_state"].get("quantity"),
            "cash_movement": r["cash_movement"], "rule_applied": r["rule_applied"],
        })

    # future actions (pending events on securities this portfolio holds)
    held = {p.security_id: p for p in positions}
    pending = (db.query(CorporateAction)
               .filter(CorporateAction.status == "PENDING",
                       CorporateAction.security_id.in_(list(held)))
               .all()) if held else []
    future = [_estimate(a, held[a.security_id]) for a in pending]

    data = {
        "portfolio_id": portfolio_id, "portfolio_name": pf.portfolio_name,
        "generated_on": date.today().isoformat(),
        "holdings": holdings,
        "totals": {"cost": round(cost_total, 2), "market_value": round(value_total, 2),
                   "cash": round(cash, 2), "total_value": round(total, 2),
                   "pnl": round(value_total - priced_cost, 2)},
        "allocation": allocation, "past_actions": past, "future_actions": future,
    }
    data["summary"] = build_summary(data)
    return data


def build_summary(data: dict) -> str:
    """Template-based summary. Swap for an LLM call later if you want."""
    t = data["totals"]
    parts = [f"{data['portfolio_name']} holds {len(data['holdings'])} position(s) with a market value of "
             f"{t['market_value']:,.2f} and cash of {t['cash']:,.2f}, giving a total value of {t['total_value']:,.2f}."]
    missing = [h["security_id"] for h in data["holdings"] if h["price"] is None]
    if missing:
        parts.append(f"No price was found for {', '.join(missing)}, so those positions are not valued.")

    past = data["past_actions"]
    if past:
        kinds = Counter(p["action_type"] or "unknown" for p in past)
        kinds_txt = ", ".join(f"{n} x {k}" for k, n in kinds.items())
        cash_in = sum(p["cash_movement"] or 0 for p in past)
        parts.append(f"{len(past)} corporate action adjustment(s) have been processed ({kinds_txt}), "
                     f"with a net cash movement of {cash_in:,.2f}.")
    else:
        parts.append("No corporate actions have been processed for this portfolio yet.")

    future = data["future_actions"]
    if future:
        est_cash = sum(f["est_cash"] or 0 for f in future)
        nxt = min((f["record_date"] for f in future if f["record_date"]), default=None)
        parts.append(f"{len(future)} action(s) are pending"
                     + (f", the next record date is {nxt}" if nxt else "")
                     + f", with an expected cash inflow of {est_cash:,.2f}.")
    else:
        parts.append("There are no pending corporate actions.")
    return " ".join(parts)