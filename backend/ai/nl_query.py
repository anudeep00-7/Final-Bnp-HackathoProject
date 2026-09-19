import re

from sqlalchemy.orm import Session

from models.audit_log import AuditLog
from models.corporate_action import CorporateAction
from models.security import Security
from services.audit_service import ALL_PORTFOLIOS, allowed_portfolios, serialize

# (regex in question, LIKE pattern on action_type, NOT LIKE pattern, label)
TYPE_RULES = [
    (r"reverse\s+(?:stock\s+)?split", "%REVERSE%", None, "reverse split"),
    (r"stock\s+split", "%SPLIT%", "%REVERSE%", "stock split"),
    (r"\bsplit", "%SPLIT%", None, "split"),
    (r"stock\s+dividend", "%STOCK%DIV%", None, "stock dividend"),
    (r"dividend", "%DIVIDEND%", "%STOCK%", "dividend"),
    (r"bonus", "%BONUS%", None, "bonus issue"),
    (r"name\s+change|renam", "%NAME%", None, "name change"),
    (r"rights", "%RIGHTS%", None, "rights issue"),
    (r"merger|amalgamat", "%MERGER%", None, "merger"),
    (r"tender", "%TENDER%", None, "tender offer"),
    (r"spin", "%SPIN%", None, "spin-off"),
]


def _first(pattern, text):
    m = re.search(pattern, text, re.I)
    return m.group(0).upper() if m else None


def _find_type(ql):
    for rx, like, unlike, label in TYPE_RULES:
        if re.search(rx, ql):
            return (like, unlike, label)
    return None


def _find_security_id(db, q):
    sid = _first(r"\bSEC\d{3}\b", q)
    if sid:
        return sid
    for s in db.query(Security).all():
        for token in (s.ticker, s.security_name):
            if token and re.search(rf"\b{re.escape(token)}\b", q, re.I):
                return s.security_id
    return None


def _base(db, user, f):
    q = (db.query(AuditLog, CorporateAction)
         .join(CorporateAction, CorporateAction.action_id == AuditLog.action_id)
         .filter(AuditLog.portfolio_id != ALL_PORTFOLIOS))
    allowed = allowed_portfolios(user)
    if allowed is not None:                       # Analysts only see their portfolios
        q = q.filter(AuditLog.portfolio_id.in_(list(allowed)))
    if f["security_id"]:
        q = q.filter(CorporateAction.security_id == f["security_id"])
    if f["action_id"]:
        q = q.filter(AuditLog.action_id == f["action_id"])
    if f["portfolio_id"]:
        q = q.filter(AuditLog.portfolio_id == f["portfolio_id"])
    if f["type"]:
        like, unlike, _ = f["type"]
        q = q.filter(CorporateAction.action_type.ilike(like))
        if unlike:
            q = q.filter(~CorporateAction.action_type.ilike(unlike))
    return q


def _describe(f):
    parts = []
    if f["type"]:
        parts.append(f["type"][2])
    if f["action_id"]:
        parts.append(f["action_id"])
    if f["security_id"]:
        parts.append(f"on {f['security_id']}")
    if f["portfolio_id"]:
        parts.append(f"in {f['portfolio_id']}")
    return " ".join(parts) or "all actions"


HELP = ("I can answer things like: 'how many portfolios were impacted by the stock split of SEC006', "
        "'total cash paid for CA001', 'show actions for portfolio P001', 'which actions were rejected'.")


def answer(db: Session, question: str, user: dict) -> dict:
    q = (question or "").strip()
    if not q:
        raise ValueError("Question is empty")
    ql = q.lower()
    f = {"security_id": _find_security_id(db, q), "action_id": _first(r"\bCA\d{3}\b", q),
         "portfolio_id": _first(r"\bP\d{3}\b", q), "type": _find_type(ql)}
    interpreted = {**f, "type": f["type"][2] if f["type"] else None}
    desc = _describe(f)

    # 1. how many portfolios impacted
    if re.search(r"how many portfolios|portfolios? (were |was |are )?(impacted|affected)|number of portfolios", ql):
        rows = _base(db, user, f).all()
        pids = sorted({a.portfolio_id for a, _ in rows})
        text = f"{len(pids)} portfolio(s) impacted by {desc}" + (f": {', '.join(pids)}" if pids else "")
        return {"question": q, "answer": text, "data": {"count": len(pids), "portfolios": pids},
                "interpreted_as": interpreted}

    # 2. status questions (rejected / failed / pending / processed actions)
    st = re.search(r"\b(rejected|failed|pending|processed)\b", ql)
    if st and re.search(r"\b(actions?|events?)\b", ql):
        status = st.group(1).upper()
        aq = db.query(CorporateAction).filter(CorporateAction.status == status)
        if f["security_id"]:
            aq = aq.filter(CorporateAction.security_id == f["security_id"])
        ids = [a.action_id for a in aq.all()]
        return {"question": q, "answer": f"{len(ids)} action(s) are {status}" + (f": {', '.join(ids)}" if ids else ""),
                "data": {"count": len(ids), "action_ids": ids}, "interpreted_as": interpreted}

    # 3. cash totals
    if re.search(r"\b(cash|paid|received|payout|how much)\b", ql):
        rows = _base(db, user, f).all()
        total = round(sum(a.cash_movement or 0 for a, _ in rows), 2)
        return {"question": q, "answer": f"Total cash movement for {desc}: {total:,.2f} across {len(rows)} audit record(s)",
                "data": {"total_cash": total, "records": len(rows)}, "interpreted_as": interpreted}

    # 4. list audit records
    if any(f.values()) or re.search(r"\b(show|list|history|audit)\b", ql):
        rows = _base(db, user, f).order_by(AuditLog.timestamp.desc()).limit(20).all()
        return {"question": q, "answer": f"Showing {len(rows)} most recent audit record(s) for {desc}",
                "data": [serialize(a) for a, _ in rows], "interpreted_as": interpreted}

    return {"question": q, "answer": HELP, "data": None, "interpreted_as": interpreted}