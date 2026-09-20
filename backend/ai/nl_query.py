"""
nl_query.py

Comprehensive natural-language query engine over the corporate_actions schema.
Queries LIVE database data across all tables:
  - portfolios, securities, positions, cash_balances, prices
  - corporate_action_events, ca_elections, settlements
  - audit_logs, ca_processing, processing_reconciliation

Updated to use correct model field names and query live DB for every response.
"""

import re
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from models.audit_log import AuditLog
from models.corporate_action import CorporateActionEvent
from models.security import Security
from models.position import Position
from services.audit_service import ALL_PORTFOLIOS, allowed_portfolios, serialize

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _first(pattern, txt):
    m = re.search(pattern, txt, re.I)
    return m.group(0).upper() if m else None


def _dec(v):
    """Convert Decimal/float/None to float safely."""
    if v is None:
        return 0.0
    return float(v)


# ---------------------------------------------------------------------------
# Live DB queries
# ---------------------------------------------------------------------------

def _query_portfolios(db):
    """Return all portfolios with current cash."""
    sql = text("""
        SELECT p.portfolio_id, p.portfolio_name, p.client_id, p.client_type, p.base_currency,
               COALESCE(cb.balance, 0) AS cash_balance
        FROM corporate_actions.portfolios p
        LEFT JOIN corporate_actions.cash_balances cb ON p.portfolio_id = cb.portfolio_id
        ORDER BY p.portfolio_id
    """)
    rows = db.execute(sql).mappings().all()
    return [dict(r) for r in rows]


def _query_securities(db):
    """Return all securities with latest price."""
    sql = text("""
        SELECT s.security_id, s.symbol, s.name, s.type, s.currency, s.status,
               (SELECT pr.close_price FROM corporate_actions.prices pr
                WHERE pr.security_id = s.security_id
                ORDER BY pr.price_date DESC LIMIT 1) AS latest_price
        FROM corporate_actions.securities s
        ORDER BY s.security_id
    """)
    rows = db.execute(sql).mappings().all()
    return [dict(r) for r in rows]


def _query_holdings(db, portfolio_id=None):
    """Return positions with security details."""
    filters = ""
    params = {}
    if portfolio_id:
        filters = "WHERE pos.portfolio_id = :pid"
        params["pid"] = portfolio_id
    sql = text(f"""
        SELECT pos.portfolio_id, pos.security_id, pos.qty, pos.avg_cost,
               s.symbol, s.name AS security_name, s.type AS security_type,
               p.portfolio_name
        FROM corporate_actions.current_positions pos
        JOIN corporate_actions.securities s ON pos.security_id = s.security_id
        JOIN corporate_actions.portfolios p ON pos.portfolio_id = p.portfolio_id
        {filters}
        ORDER BY pos.portfolio_id, pos.security_id
    """)
    rows = db.execute(sql, params).mappings().all()
    return [dict(r) for r in rows]


def _query_elections(db, ca_id=None, portfolio_id=None):
    """Return elections from ca_elections."""
    filters = []
    params = {}
    if ca_id:
        filters.append("e.ca_id = :ca_id")
        params["ca_id"] = ca_id
    if portfolio_id:
        filters.append("e.portfolio_id = :pid")
        params["pid"] = portfolio_id
    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    sql = text(f"""
        SELECT e.election_id, e.ca_id, e.portfolio_id, e.election_type,
               e.elected_qty, e.election_date, e.status, e.notes,
               ca.action_type, ca.security_id,
               s.name AS security_name, s.symbol
        FROM corporate_actions.ca_elections e
        JOIN corporate_actions.corporate_action_events ca ON e.ca_id = ca.ca_id
        JOIN corporate_actions.securities s ON ca.security_id = s.security_id
        {where}
        ORDER BY e.election_id
    """)
    rows = db.execute(sql, params).mappings().all()
    return [dict(r) for r in rows]


def _query_settlements(db, portfolio_id=None, ca_id=None, limit=20):
    """Return settlement records."""
    filters = []
    params = {"limit": limit}
    if portfolio_id:
        filters.append("s.portfolio_id = :pid")
        params["pid"] = portfolio_id
    if ca_id:
        filters.append("cp.ca_id = :ca_id")
        params["ca_id"] = ca_id
    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    sql = text(f"""
        SELECT s.settlement_id, s.portfolio_id, s.security_id, s.leg_code,
               s.settlement_type, s.quantity_movement, s.cash_movement,
               s.currency, s.recognition_date, s.settlement_date, s.status,
               cp.ca_id, cae.action_type,
               sec.name AS security_name, sec.symbol,
               p.portfolio_name
        FROM corporate_actions.settlements s
        LEFT JOIN corporate_actions.ca_processing cp ON s.processing_id = cp.processing_id
        LEFT JOIN corporate_actions.corporate_action_events cae ON cp.ca_id = cae.ca_id
        LEFT JOIN corporate_actions.securities sec ON s.security_id = sec.security_id
        LEFT JOIN corporate_actions.portfolios p ON s.portfolio_id = p.portfolio_id
        {where}
        ORDER BY s.settlement_id DESC
        LIMIT :limit
    """)
    rows = db.execute(sql, params).mappings().all()
    return [dict(r) for r in rows]


def _query_reconciliation(db, ca_id=None, portfolio_id=None, limit=20):
    """Return reconciliation records."""
    filters = []
    params = {"limit": limit}
    if ca_id:
        filters.append("pr.ca_id = :ca_id")
        params["ca_id"] = ca_id
    if portfolio_id:
        filters.append("pr.portfolio_id = :pid")
        params["pid"] = portfolio_id
    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    sql = text(f"""
        SELECT pr.processing_id, pr.ca_id, pr.portfolio_id,
               pr.status AS processing_status,
               COALESCE(pr.before_total, 0) AS before_total,
               COALESCE(pr.after_total, 0) AS after_total,
               COALESCE(pr.observed_difference, 0) AS observed_difference,
               COALESCE(pr.expected_leakage, 0) AS expected_leakage,
               COALESCE(pr.reconciliation_difference, 0) AS reconciliation_difference,
               cae.action_type, cae.security_id,
               CASE WHEN ABS(COALESCE(pr.reconciliation_difference, 0)) <= 0.01 THEN true ELSE false END AS reconciled
        FROM corporate_actions.processing_reconciliation pr
        LEFT JOIN corporate_actions.corporate_action_events cae ON pr.ca_id = cae.ca_id
        {where}
        ORDER BY pr.processing_id DESC
        LIMIT :limit
    """)
    try:
        rows = db.execute(sql, params).mappings().all()
        return [dict(r) for r in rows]
    except Exception:
        return []


def _query_actions(db, status=None, security_id=None, ca_id=None):
    """Return corporate actions with enriched data."""
    filters = []
    params = {}
    if status:
        filters.append("cae.status = :status")
        params["status"] = status
    if security_id:
        filters.append("cae.security_id = :sec_id")
        params["sec_id"] = security_id
    if ca_id:
        filters.append("cae.ca_id = :ca_id")
        params["ca_id"] = ca_id
    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    sql = text(f"""
        SELECT cae.ca_id, cae.security_id, cae.action_type, cae.tier, cae.status,
               cae.ex_date, cae.record_date, cae.pay_date, cae.election_deadline,
               cae.cash_rate_per_share, cae.ratio_numerator, cae.ratio_denominator,
               cae.subscription_price, cae.offer_price, cae.notes,
               s.name AS security_name, s.symbol
        FROM corporate_actions.corporate_action_events cae
        JOIN corporate_actions.securities s ON cae.security_id = s.security_id
        {where}
        ORDER BY cae.ca_id
    """)
    rows = db.execute(sql, params).mappings().all()
    return [dict(r) for r in rows]


def _query_prices(db, security_id=None):
    """Return price history."""
    filters = []
    params = {}
    if security_id:
        filters.append("pr.security_id = :sec_id")
        params["sec_id"] = security_id
    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    sql = text(f"""
        SELECT pr.security_id, s.symbol, s.name AS security_name,
               pr.price_date, pr.close_price, pr.note
        FROM corporate_actions.prices pr
        JOIN corporate_actions.securities s ON pr.security_id = s.security_id
        {where}
        ORDER BY pr.security_id, pr.price_date DESC
    """)
    rows = db.execute(sql, params).mappings().all()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# ID / entity extraction
# ---------------------------------------------------------------------------

def _find_security_id(db, q):
    sid = _first(r"\bSEC\d{3}\b", q)
    if sid:
        return sid
    for s in db.query(Security).all():
        for token in (s.symbol, s.name):
            if token and re.search(rf"\b{re.escape(token)}\b", q, re.I):
                return s.security_id
    return None


def _find_portfolio_id(q):
    return _first(r"\bP\d{3}\b", q)


def _find_action_id(q):
    return _first(r"\bCA\d{3}\b", q)


def _find_status(q):
    ql = q.lower()
    for s in ("rejected", "failed", "pending", "processed", "active", "reversed", "confirmed", "cancelled"):
        if s in ql:
            return s.upper()
    return None


# ---------------------------------------------------------------------------
# Intent detection & routing
# ---------------------------------------------------------------------------

HELP = (
    "I can answer questions about:\n"
    "• **Portfolios**: cash balances, holdings, AUM (e.g., 'Show all portfolios', 'What is P001 cash balance?')\n"
    "• **Securities**: prices, types, symbols (e.g., 'List all securities', 'Price of SEC006')\n"
    "• **Corporate Actions**: status, dates, ratios (e.g., 'Active actions', 'Details of CA001')\n"
    "• **Elections**: client decisions on voluntary actions (e.g., 'Show all elections', 'Elections for CA008')\n"
    "• **Settlements**: cash/security movements (e.g., 'Settlements for P001')\n"
    "• **Reconciliation**: discrepancies, leakage (e.g., 'Reconciliation status')\n"
    "• **Impact analysis**: 'How many portfolios were impacted by the stock split of SEC006?'\n"
    "• **Cash totals**: 'Total cash paid for CA001'\n"
)


def answer(db: Session, question: str, user) -> dict:
    q = (question or "").strip()
    if not q:
        raise ValueError("Question is empty")
    ql = q.lower()

    portfolio_id = _find_portfolio_id(q)
    action_id = _find_action_id(q)
    security_id = _find_security_id(db, q)
    status = _find_status(q)

    # ── 1. Portfolio queries (only if no domain-specific keyword present) ──
    has_domain_keyword = bool(re.search(r"\b(settl\w+|reconcil\w*|exception|variance|leakage|election\w*|voluntary|subscribe|lapse|tender|drip|convert|entitlement|pric\w+|audit|log|trail)\b", ql))
    if not has_domain_keyword and re.search(r"\b(all\s+)?portfolios?\b", ql) and re.search(r"\b(show|list|what|get|display|aum|cash|balance|overview|all)\b", ql) and not action_id:
        if portfolio_id:
            # Single portfolio detail
            holdings = _query_holdings(db, portfolio_id)
            portfolios = _query_portfolios(db)
            port = next((p for p in portfolios if p["portfolio_id"] == portfolio_id), None)
            if not port:
                return {"question": q, "answer": f"Portfolio {portfolio_id} not found in database.", "data": None}

            total_value = sum(_dec(h["qty"]) * _dec(h["avg_cost"]) for h in holdings)
            cash = _dec(port.get("cash_balance", 0))

            lines = [
                f"**{port['portfolio_name']}** (`{port['portfolio_id']}`) — {port['client_type']} | {port['base_currency']}",
                f"**Cash Balance:** ${cash:,.2f}",
                f"**Holdings ({len(holdings)}):**",
            ]
            for h in holdings:
                val = _dec(h["qty"]) * _dec(h["avg_cost"])
                lines.append(f"  • {h['symbol']} ({h['security_name']}): {_dec(h['qty']):,.0f} shares @ ${_dec(h['avg_cost']):.2f} = ${val:,.2f}")
            lines.append(f"**Total Book Value:** ${total_value:,.2f} | **Total AUM (incl. cash):** ${total_value + cash:,.2f}")

            return {"question": q, "answer": "\n".join(lines), "data": {"portfolio": port, "holdings": holdings}}
        else:
            # All portfolios overview
            portfolios = _query_portfolios(db)
            lines = [f"**{len(portfolios)} portfolios** in the system:\n"]
            for p in portfolios:
                cash = _dec(p.get("cash_balance", 0))
                lines.append(f"• **{p['portfolio_id']}** — {p['portfolio_name']} ({p['client_type']}) | Cash: ${cash:,.2f}")
            total_cash = sum(_dec(p.get("cash_balance", 0)) for p in portfolios)
            lines.append(f"\n**Total cash across all portfolios:** ${total_cash:,.2f}")
            return {"question": q, "answer": "\n".join(lines), "data": portfolios}

    # ── 2. Securities queries ─────────────────────────────────────────────
    if re.search(r"\b(securit|stock|equity|instrument)\w*\b", ql) and re.search(r"\b(show|list|all|what|get|display|price|overview)\b", ql) and not action_id:
        if security_id:
            securities = _query_securities(db)
            sec = next((s for s in securities if s["security_id"] == security_id), None)
            if not sec:
                return {"question": q, "answer": f"Security {security_id} not found.", "data": None}
            holders = _query_holdings(db)
            sec_holders = [h for h in holders if h["security_id"] == security_id]
            actions = _query_actions(db, security_id=security_id)
            price = _dec(sec.get("latest_price", 0))
            total_qty = sum(_dec(h["qty"]) for h in sec_holders)

            lines = [
                f"**{sec['name']}** ({sec['symbol']}) — `{sec['security_id']}`",
                f"**Type:** {sec['type']} | **Currency:** {sec['currency']} | **Status:** {sec['status']}",
                f"**Latest Price:** ${price:.2f}" if price else "**Latest Price:** N/A",
                f"**Held across {len(sec_holders)} portfolios** — Total: {total_qty:,.0f} shares",
            ]
            for h in sec_holders:
                lines.append(f"  • {h['portfolio_id']} ({h['portfolio_name']}): {_dec(h['qty']):,.0f} shares @ ${_dec(h['avg_cost']):.2f}")
            if actions:
                lines.append(f"**Corporate Actions ({len(actions)}):**")
                for a in actions:
                    lines.append(f"  • {a['ca_id']} ({a['action_type']}) — {a['status']} — {a.get('notes', '')[:80]}")
            return {"question": q, "answer": "\n".join(lines), "data": {"security": sec, "holders": sec_holders}}
        else:
            securities = _query_securities(db)
            lines = [f"**{len(securities)} securities** registered:\n"]
            for s in securities:
                price = _dec(s.get("latest_price", 0))
                lines.append(f"• **{s['security_id']}** — {s['symbol']} ({s['name']}) | {s['type']} | ${price:.2f}")
            return {"question": q, "answer": "\n".join(lines), "data": securities}

    # ── 3. Price queries ──────────────────────────────────────────────────
    if re.search(r"\b(price|pricing|close|market\s+value|valuation)\b", ql):
        prices = _query_prices(db, security_id)
        if not prices:
            return {"question": q, "answer": f"No price data found{' for ' + security_id if security_id else ''}.", "data": None}
        if security_id:
            lines = [f"**Price history for {prices[0]['security_name']} ({prices[0]['symbol']}):**\n"]
            for p in prices[:15]:
                lines.append(f"• {p['price_date']}: ${_dec(p['close_price']):.2f} — {p.get('note', '')}")
            return {"question": q, "answer": "\n".join(lines), "data": prices[:15]}
        else:
            # Latest price per security
            seen = set()
            latest = []
            for p in prices:
                if p["security_id"] not in seen:
                    seen.add(p["security_id"])
                    latest.append(p)
            lines = ["**Latest prices:**\n"]
            for p in latest:
                lines.append(f"• {p['symbol']} ({p['security_name']}): ${_dec(p['close_price']):.2f}")
            return {"question": q, "answer": "\n".join(lines), "data": latest}

    # ── 4. Election queries ───────────────────────────────────────────────
    if re.search(r"\b(election|voluntary|subscribe|lapse|tender|drip|convert|entitlement)\b", ql):
        elections = _query_elections(db, ca_id=action_id, portfolio_id=portfolio_id)
        if not elections:
            return {"question": q, "answer": "No election records found" + (f" for {action_id or portfolio_id}" if (action_id or portfolio_id) else "") + ".", "data": []}
        lines = [f"**{len(elections)} election record(s):**\n"]
        for e in elections:
            qty_str = f"{_dec(e['elected_qty']):,.0f}" if e.get("elected_qty") is not None else "N/A"
            lines.append(
                f"• **{e['election_id']}** — {e['ca_id']} ({e['action_type']}) | "
                f"{e['portfolio_id']} | {e['election_type']} | Qty: {qty_str} | "
                f"Status: {e['status']} | {e.get('notes', '')[:60]}"
            )
        return {"question": q, "answer": "\n".join(lines), "data": elections}

    # ── 5. Settlement queries ─────────────────────────────────────────────
    if re.search(r"\b(settlements?|settl\w+|cash\s+movement|security\s+movement)\b", ql):
        settlements = _query_settlements(db, portfolio_id=portfolio_id, ca_id=action_id)
        if not settlements:
            return {"question": q, "answer": "No settlement records found.", "data": []}
        total_cash = sum(_dec(s.get("cash_movement", 0)) for s in settlements)
        total_qty = sum(_dec(s.get("quantity_movement", 0)) for s in settlements)
        lines = [
            f"**{len(settlements)} settlement record(s):**",
            f"**Aggregate:** Cash: ${total_cash:,.2f} | Securities: {total_qty:,.0f} units\n",
        ]
        for s in settlements[:15]:
            lines.append(
                f"• #{s['settlement_id']} — {s.get('ca_id', 'N/A')} ({s.get('action_type', 'N/A')}) | "
                f"{s['portfolio_id']} | {s['security_id']} ({s.get('symbol', '')}) | "
                f"{s['leg_code']}: Cash ${_dec(s['cash_movement']):,.2f}, Qty {_dec(s['quantity_movement']):,.0f} | "
                f"{s['status']}"
            )
        return {"question": q, "answer": "\n".join(lines), "data": settlements}

    # ── 6. Reconciliation queries ─────────────────────────────────────────
    if re.search(r"\b(reconcil\w*|exception|variance|leakage|discrep\w*)\b", ql) and not re.search(r"\baudit\s+(trail|log|record)\b", ql):
        recs = _query_reconciliation(db, ca_id=action_id, portfolio_id=portfolio_id)
        if not recs:
            return {"question": q, "answer": "No reconciliation records found. All processed actions may be fully reconciled.", "data": []}
        reconciled_count = sum(1 for r in recs if r.get("reconciled"))
        unreconciled = [r for r in recs if not r.get("reconciled")]
        lines = [
            f"**{len(recs)} reconciliation record(s):** {reconciled_count} reconciled, {len(unreconciled)} unreconciled\n",
        ]
        for r in recs[:15]:
            status_icon = "✅" if r.get("reconciled") else "⚠️"
            lines.append(
                f"{status_icon} #{r['processing_id']} — {r['ca_id']} ({r.get('action_type', 'N/A')}) | "
                f"{r['portfolio_id']} | {r.get('security_id', 'N/A')} | "
                f"Before: ${_dec(r.get('before_total', 0)):,.2f} → After: ${_dec(r.get('after_total', 0)):,.2f} | "
                f"Diff: ${_dec(r.get('reconciliation_difference', 0)):,.4f}"
            )
        return {"question": q, "answer": "\n".join(lines), "data": recs}

    # ── 7. Portfolio impact ───────────────────────────────────────────────
    if re.search(r"how many portfolios|portfolios? (were |was |are )?(impacted|affected)|number of portfolios", ql):
        # Find which portfolios hold the security referenced
        sid = security_id
        if not sid and action_id:
            actions = _query_actions(db, ca_id=action_id)
            if actions:
                sid = actions[0].get("security_id")
        if sid:
            holders = _query_holdings(db)
            pids = sorted(set(h["portfolio_id"] for h in holders if h["security_id"] == sid))
            sec_info = next((s for s in _query_securities(db) if s["security_id"] == sid), {})
            sec_name = sec_info.get("name", sid)
            text_answer = f"**{len(pids)} portfolio(s)** hold **{sec_name}** (`{sid}`) and are impacted: {', '.join(pids)}"
            return {"question": q, "answer": text_answer, "data": {"count": len(pids), "portfolios": pids}}
        # Fallback: count distinct portfolios in audit
        return {"question": q, "answer": "Please specify a security ID (e.g., SEC006) or action ID (e.g., CA002) to check portfolio impact.", "data": None}

    # ── 8. Status queries ─────────────────────────────────────────────────
    if status and re.search(r"\b(actions?|events?|corporate)\b", ql):
        actions = _query_actions(db, status=status, security_id=security_id)
        if not actions:
            # Check computed status from ca_processing
            all_actions = _query_actions(db, security_id=security_id)
            if status == "PROCESSED":
                processed_ids = set()
                try:
                    sql = text("SELECT DISTINCT ca_id FROM corporate_actions.ca_processing WHERE status = 'PROCESSED' AND reversal_of IS NULL")
                    processed_ids = {r[0] for r in db.execute(sql).all()}
                except Exception:
                    pass
                actions = [a for a in all_actions if a["ca_id"] in processed_ids]
            elif status == "REVERSED":
                reversed_ids = set()
                try:
                    sql = text("SELECT DISTINCT ca_id FROM corporate_actions.ca_processing WHERE reversal_of IS NOT NULL")
                    reversed_ids = {r[0] for r in db.execute(sql).all()}
                except Exception:
                    pass
                actions = [a for a in all_actions if a["ca_id"] in reversed_ids]

        if not actions:
            return {"question": q, "answer": f"No {status} corporate actions found.", "data": []}
        lines = [f"**{len(actions)} {status} action(s):**\n"]
        for a in actions:
            lines.append(f"• **{a['ca_id']}** — {a['action_type']} on {a['symbol']} ({a['security_name']}) | Ex-Date: {a.get('ex_date', 'N/A')}")
        return {"question": q, "answer": "\n".join(lines), "data": actions}

    # ── 9. Cash / dividend totals ─────────────────────────────────────────
    if re.search(r"\b(cash|paid|received|payout|how much|dividend|total)\b", ql):
        if action_id:
            actions = _query_actions(db, ca_id=action_id)
            ca = actions[0] if actions else None
            if ca and _dec(ca.get("cash_rate_per_share", 0)) > 0:
                # Calculate dividend across holders
                holders = _query_holdings(db)
                sec_holders = [h for h in holders if h["security_id"] == ca["security_id"]]
                rate = _dec(ca["cash_rate_per_share"])
                total_shares = sum(_dec(h["qty"]) for h in sec_holders)
                gross = total_shares * rate
                lines = [
                    f"**{ca['ca_id']}** — {ca['action_type']} on {ca['symbol']} ({ca['security_name']})",
                    f"**Rate:** ${rate:.2f}/share",
                    f"**Total eligible shares:** {total_shares:,.0f} across {len(sec_holders)} portfolios",
                    f"**Gross payout:** ${gross:,.2f}",
                ]
                for h in sec_holders:
                    payout = _dec(h["qty"]) * rate
                    lines.append(f"  • {h['portfolio_id']} ({h['portfolio_name']}): {_dec(h['qty']):,.0f} shares → ${payout:,.2f}")
                return {"question": q, "answer": "\n".join(lines), "data": {"total_cash": gross, "per_portfolio": sec_holders}}

        # Aggregate settlements cash
        settlements = _query_settlements(db, portfolio_id=portfolio_id, ca_id=action_id, limit=500)
        total = sum(_dec(s.get("cash_movement", 0)) for s in settlements)
        return {
            "question": q,
            "answer": f"**Total cash movement:** ${total:,.2f} across {len(settlements)} settlement record(s)" + (f" for {portfolio_id or action_id}" if (portfolio_id or action_id) else ""),
            "data": {"total_cash": total, "records": len(settlements)}
        }

    # ── 10. Specific corporate action detail ──────────────────────────────
    if action_id:
        actions = _query_actions(db, ca_id=action_id)
        if not actions:
            return {"question": q, "answer": f"Corporate action {action_id} not found.", "data": None}
        ca = actions[0]
        holders = _query_holdings(db)
        sec_holders = [h for h in holders if h["security_id"] == ca["security_id"]]
        elections = _query_elections(db, ca_id=action_id)
        lines = [
            f"**{ca['ca_id']}** — {ca['action_type']} on {ca['symbol']} ({ca['security_name']})",
            f"**Status:** {ca['status']} | **Tier:** {ca.get('tier', 'N/A')}",
            f"**Ex-Date:** {ca.get('ex_date', 'N/A')} | **Record Date:** {ca.get('record_date', 'N/A')} | **Pay Date:** {ca.get('pay_date', 'N/A')}",
        ]
        if ca.get("cash_rate_per_share"):
            lines.append(f"**Cash Rate:** ${_dec(ca['cash_rate_per_share']):.2f}/share")
        if ca.get("ratio_numerator") and ca.get("ratio_denominator"):
            lines.append(f"**Ratio:** {_dec(ca['ratio_numerator']):.0f}:{_dec(ca['ratio_denominator']):.0f}")
        if ca.get("subscription_price"):
            lines.append(f"**Subscription Price:** ${_dec(ca['subscription_price']):.2f}")
        if ca.get("offer_price"):
            lines.append(f"**Offer Price:** ${_dec(ca['offer_price']):.2f}")
        if ca.get("election_deadline"):
            lines.append(f"**Election Deadline:** {ca['election_deadline']}")
        lines.append(f"**Notes:** {ca.get('notes', 'N/A')}")
        lines.append(f"\n**Impacted Portfolios ({len(sec_holders)}):**")
        for h in sec_holders:
            lines.append(f"  • {h['portfolio_id']} ({h['portfolio_name']}): {_dec(h['qty']):,.0f} shares")
        if elections:
            lines.append(f"\n**Elections ({len(elections)}):**")
            for e in elections:
                qty_str = f"{_dec(e['elected_qty']):,.0f}" if e.get("elected_qty") is not None else "N/A"
                lines.append(f"  • {e['election_id']}: {e['portfolio_id']} — {e['election_type']} (Qty: {qty_str}) — {e['status']}")
        return {"question": q, "answer": "\n".join(lines), "data": ca}

    # ── 11. Specific security detail ──────────────────────────────────────
    if security_id:
        securities = _query_securities(db)
        sec = next((s for s in securities if s["security_id"] == security_id), None)
        if not sec:
            return {"question": q, "answer": f"Security {security_id} not found.", "data": None}
        holders = _query_holdings(db)
        sec_holders = [h for h in holders if h["security_id"] == security_id]
        actions = _query_actions(db, security_id=security_id)
        price = _dec(sec.get("latest_price", 0))
        total_qty = sum(_dec(h["qty"]) for h in sec_holders)
        lines = [
            f"**{sec['name']}** ({sec['symbol']}) — `{sec['security_id']}`",
            f"**Type:** {sec['type']} | **Currency:** {sec['currency']} | **Status:** {sec['status']}",
            f"**Latest Price:** ${price:.2f}" if price else "**Latest Price:** N/A",
            f"**Held across {len(sec_holders)} portfolios** — Total: {total_qty:,.0f} shares",
        ]
        for h in sec_holders:
            lines.append(f"  • {h['portfolio_id']} ({h['portfolio_name']}): {_dec(h['qty']):,.0f} shares @ ${_dec(h['avg_cost']):.2f}")
        if actions:
            lines.append(f"\n**Corporate Actions ({len(actions)}):**")
            for a in actions:
                lines.append(f"  • {a['ca_id']} ({a['action_type']}) — {a['status']} | {a.get('notes', '')[:80]}")
        return {"question": q, "answer": "\n".join(lines), "data": sec}

    # ── 12. Portfolio detail (fallback for P### reference) ────────────────
    if portfolio_id:
        portfolios = _query_portfolios(db)
        port = next((p for p in portfolios if p["portfolio_id"] == portfolio_id), None)
        if not port:
            return {"question": q, "answer": f"Portfolio {portfolio_id} not found.", "data": None}
        holdings = _query_holdings(db, portfolio_id)
        total_value = sum(_dec(h["qty"]) * _dec(h["avg_cost"]) for h in holdings)
        cash = _dec(port.get("cash_balance", 0))
        # Get associated corporate actions
        held_sec_ids = set(h["security_id"] for h in holdings)
        all_actions = _query_actions(db)
        relevant_actions = [a for a in all_actions if a["security_id"] in held_sec_ids]
        lines = [
            f"**{port['portfolio_name']}** (`{port['portfolio_id']}`) — {port['client_type']} | {port['base_currency']}",
            f"**Cash Balance:** ${cash:,.2f}",
            f"**Holdings ({len(holdings)}):**",
        ]
        for h in holdings:
            val = _dec(h["qty"]) * _dec(h["avg_cost"])
            lines.append(f"  • {h['symbol']} ({h['security_name']}): {_dec(h['qty']):,.0f} shares @ ${_dec(h['avg_cost']):.2f} = ${val:,.2f}")
        lines.append(f"**Total Book Value:** ${total_value:,.2f} | **Total AUM (incl. cash):** ${total_value + cash:,.2f}")
        if relevant_actions:
            lines.append(f"\n**Applicable Corporate Actions ({len(relevant_actions)}):**")
            for a in relevant_actions:
                lines.append(f"  • {a['ca_id']} ({a['action_type']}) on {a['symbol']} — {a['status']}")
        return {"question": q, "answer": "\n".join(lines), "data": {"portfolio": port, "holdings": holdings}}

    # ── 13. General "show" / "list" / "actions" queries ───────────────────
    if re.search(r"\b(show|list|all|what|get|display)\b", ql) and re.search(r"\b(action|event|corporate)\b", ql):
        actions = _query_actions(db, security_id=security_id)
        lines = [f"**{len(actions)} corporate action(s):**\n"]
        for a in actions:
            lines.append(
                f"• **{a['ca_id']}** — {a['action_type']} on {a['symbol']} ({a['security_name']}) | "
                f"Status: {a['status']} | Ex-Date: {a.get('ex_date', 'N/A')}"
            )
        return {"question": q, "answer": "\n".join(lines), "data": actions}

    # ── 14. Audit log queries ─────────────────────────────────────────────
    if re.search(r"\b(audit|log|history|trail)\b", ql):
        f = {
            "security_id": security_id,
            "action_id": action_id,
            "portfolio_id": portfolio_id,
            "type": None,
        }
        rows = _base_audit(db, user, f).order_by(AuditLog.occurred_at.desc()).limit(20).all()
        if rows:
            lines = [f"**{len(rows)} audit record(s):**\n"]
            for a, ca in rows:
                lines.append(
                    f"• {a.ca_id} | {a.portfolio_id} | {a.action} → {a.outcome} | "
                    f"Cash: ${_dec(a.cash_movement):,.2f} | {a.occurred_at}"
                )
            return {"question": q, "answer": "\n".join(lines), "data": [serialize(a) for a, _ in rows]}
        return {"question": q, "answer": "No audit records found for the specified criteria.", "data": []}

    # ── 15. Holdings query ────────────────────────────────────────────────
    if re.search(r"\b(holding|position|book)\b", ql):
        holdings = _query_holdings(db, portfolio_id)
        if not holdings:
            return {"question": q, "answer": f"No holdings found{' for ' + portfolio_id if portfolio_id else ''}.", "data": []}
        lines = [f"**{len(holdings)} position(s):**\n"]
        for h in holdings:
            val = _dec(h["qty"]) * _dec(h["avg_cost"])
            lines.append(f"• {h['portfolio_id']} | {h['symbol']} ({h['security_name']}): {_dec(h['qty']):,.0f} shares @ ${_dec(h['avg_cost']):.2f} = ${val:,.2f}")
        return {"question": q, "answer": "\n".join(lines), "data": holdings}

    # ── DEFAULT: Help text ────────────────────────────────────────────────
    return {"question": q, "answer": HELP, "data": None}


def _base_audit(db, user, f):
    """Build base audit query (from original code)."""
    q = (
        db.query(AuditLog, CorporateActionEvent)
        .join(CorporateActionEvent, CorporateActionEvent.ca_id == AuditLog.ca_id)
        .filter(AuditLog.portfolio_id != ALL_PORTFOLIOS)
    )
    allowed = allowed_portfolios(user)
    if allowed is not None:
        q = q.filter(AuditLog.portfolio_id.in_(list(allowed)))
    if f["security_id"]:
        q = q.filter(CorporateActionEvent.security_id == f["security_id"])
    if f["action_id"]:
        q = q.filter(AuditLog.ca_id == f["action_id"])
    if f["portfolio_id"]:
        q = q.filter(AuditLog.portfolio_id == f["portfolio_id"])
    return q