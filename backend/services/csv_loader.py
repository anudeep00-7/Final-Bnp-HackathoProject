import logging
import re

import pandas as pd
from sqlalchemy.orm import Session

import config
from models.ca_election import CaElection
from models.corporate_action import CorporateAction
from models.portfolio import Portfolio
from models.position import Position
from models.price import Price
from models.security import Security
from models.user import User

log = logging.getLogger(__name__)

# What each Tier 1 action needs before it can be processed
NEEDS = {"CASH_DIVIDEND": ["cash_rate"], "BONUS_ISSUE": ["ratio_num", "ratio_den"],
         "NAME_CHANGE": ["new_name"]}


# ---------- small helpers ----------

def _get(row, *names):
    for n in names:
        v = row.get(n)
        if v is not None and str(v).strip() != "":
            return str(v).strip()
    return None


def _need(row, *names):
    v = _get(row, *names)
    if v is None:
        raise ValueError(f"{names[0]} is missing")
    return v


def _num(row, *names, required=False, minimum=None):
    v = _get(row, *names)
    if v is None:
        if required:
            raise ValueError(f"{names[0]} is missing")
        return None
    try:
        n = float(v.replace(",", ""))
    except ValueError:
        raise ValueError(f"{names[0]} is not a number: '{v}'")
    if minimum is not None and n < minimum:
        raise ValueError(f"{names[0]} must be at least {minimum}, got {n}")
    return n


def _date(row, *names, required=False):
    v = _get(row, *names)
    if v is None:
        if required:
            raise ValueError(f"{names[0]} is missing")
        return None
    d = pd.to_datetime(v, errors="coerce")
    if pd.isna(d):
        raise ValueError(f"{names[0]} is not a valid date: '{v}'")
    return d.date()


# ---------- one builder per file: row -> model object (raises ValueError if invalid) ----------

def _security(row, ctx):
    sid = _need(row, "security_id")
    obj = Security(security_id=sid, security_name=_need(row, "name", "security_name"),
                   ticker=_get(row, "symbol", "ticker"), security_type=_get(row, "type"),
                   currency=_get(row, "currency"), underlying_security_id=_get(row, "underlying"),
                   status=_get(row, "status"))
    ctx["securities"].add(sid)
    return obj


def _portfolio(row, ctx):
    pid = _need(row, "portfolio_id")
    obj = Portfolio(portfolio_id=pid, portfolio_name=_need(row, "portfolio_name", "name"),
                    client_id=_get(row, "client_id"), client_type=_get(row, "client_type"),
                    base_currency=_get(row, "base_currency"), cash_balance=0, opening_cash=0)
    ctx["portfolios"][pid] = obj
    return obj


def _cash(row, ctx):
    pid = _need(row, "portfolio_id")
    pf = ctx["portfolios"].get(pid)
    if pf is None:
        raise ValueError(f"unknown portfolio {pid}")
    bal = _num(row, "balance", "cash_balance", required=True)
    pf.cash_balance = pf.opening_cash = bal
    pf.cash_as_of = _date(row, "as_of_date")
    return pf


def _position(row, ctx):
    pid, sid = _need(row, "portfolio_id"), _need(row, "security_id")
    if pid not in ctx["portfolios"]:
        raise ValueError(f"unknown portfolio {pid}")
    if sid not in ctx["securities"]:
        raise ValueError(f"unknown security {sid}")
    qty = _num(row, "qty", "quantity", required=True, minimum=0)
    cost = _num(row, "avg_cost", required=True, minimum=0)
    return Position(portfolio_id=pid, security_id=sid, quantity=qty, avg_cost=cost,
                    opening_quantity=qty, opening_avg_cost=cost, as_of_date=_date(row, "as_of_date"))


def _price(row, ctx):
    sid = _need(row, "security_id")
    if sid not in ctx["securities"]:
        raise ValueError(f"unknown security {sid}")
    px = _num(row, "close_price", "price", required=True)
    if px <= 0:
        raise ValueError(f"close_price must be greater than 0, got {px}")
    return Price(security_id=sid, price_date=_date(row, "price_date", required=True),
                 close_price=px, note=_get(row, "note"))


def _action(row, ctx):
    aid, sid = _need(row, "ca_id", "action_id"), _need(row, "security_id")
    if sid not in ctx["securities"]:
        raise ValueError(f"unknown security {sid}")
    a_type = _need(row, "action_type").upper().replace(" ", "_")
    src = (_get(row, "status") or "").upper()
    notes = _get(row, "notes")

    new_name = _get(row, "new_name")
    if not new_name and a_type == "NAME_CHANGE" and notes:
        m = re.search(r"(?:renamed?|changed\s+(?:its\s+)?name)\s+(?:to|as)\s+(.+?)(?:[.,;]|$)", notes, re.I)
        new_name = m.group(1).strip() if m else None

    f = {"cash_rate": _num(row, "cash_rate"), "ratio_num": _num(row, "ratio_num"),
         "ratio_den": _num(row, "ratio_den"), "new_name": new_name}
    ex, rec = _date(row, "ex_date"), _date(row, "record_date")
    pay = _date(row, "pay_date", "payment_date")

    status, message = "PENDING", None
    if src != "ACTIVE":
        status, message = "REJECTED", f"Source status is '{src or 'blank'}'; not processable"
    else:
        problems = []
        missing = [k for k in NEEDS.get(a_type, []) if f[k] in (None, "")]
        if missing:
            problems.append("Incomplete, missing " + ", ".join(missing))
        if rec and pay and pay < rec:
            problems.append("payment date is before record date")
        message = "; ".join(problems) or None

    obj = CorporateAction(
        action_id=aid, security_id=sid, action_type=a_type, tier=int(_num(row, "tier") or 0) or None,
        status=status, status_message=message, source_status=src or None,
        ex_date=ex, record_date=rec, payment_date=pay,
        election_deadline=_date(row, "election_deadline"),
        subscription_price=_num(row, "subscription_price"), offer_price=_num(row, "offer_price"),
        new_security_id=_get(row, "new_security_id"), cost_basis_pct=_num(row, "cost_basis_pct"),
        tax_withholding_pct=_num(row, "tax_withholding_pct"), notes=notes, **f)
    ctx["actions"].add(aid)
    return obj


def _election(row, ctx):
    aid, pid = _need(row, "ca_id", "action_id"), _need(row, "portfolio_id")
    if aid not in ctx["actions"]:
        raise ValueError(f"unknown corporate action {aid}")
    if pid not in ctx["portfolios"]:
        raise ValueError(f"unknown portfolio {pid}")
    return CaElection(election_id=_need(row, "election_id"), action_id=aid, portfolio_id=pid,
                      election_type=_need(row, "election_type").upper(),
                      elected_qty=_num(row, "elected_qty", minimum=0),
                      election_date=_date(row, "election_date"),
                      status=_get(row, "status"), notes=_get(row, "notes"))


def _user(row, ctx):
    role = _need(row, "role").upper()
    if role not in ("ADMIN", "ANALYST"):
        raise ValueError(f"role must be ADMIN or ANALYST, got '{role}'")
    raw = _get(row, "portfolio_id", "portfolio_ids") or ("ALL" if role == "ADMIN" else None)
    if raw is None:
        raise ValueError("an analyst needs at least one portfolio_id")
    ids = [p.strip() for p in raw.replace(";", ",").split(",") if p.strip()]
    for p in ids:
        if p != "ALL" and p not in ctx["portfolios"]:
            raise ValueError(f"unknown portfolio {p}")
    return User(user_id=_need(row, "user_id"), name=_need(row, "name", "user_name"),
                role=role, portfolio_id=",".join(ids))


# (file, required columns [any alias], key of a row, builder, optional file?)
DATASETS = [
    ("securities.csv", [("security_id",), ("name", "security_name")],
     lambda r: (_get(r, "security_id"),), _security, False),
    ("portfolios.csv", [("portfolio_id",), ("portfolio_name", "name")],
     lambda r: (_get(r, "portfolio_id"),), _portfolio, False),
    ("cash_balances.csv", [("portfolio_id",), ("balance", "cash_balance")],
     lambda r: (_get(r, "portfolio_id"),), _cash, False),
    ("positions.csv", [("portfolio_id",), ("security_id",), ("qty", "quantity"), ("avg_cost",)],
     lambda r: (_get(r, "portfolio_id"), _get(r, "security_id")), _position, False),
    ("prices.csv", [("security_id",), ("price_date",), ("close_price", "price")],
     lambda r: (_get(r, "security_id"), _get(r, "price_date"), _get(r, "note")), _price, False),
    ("corporate_actions.csv", [("ca_id", "action_id"), ("security_id",), ("action_type",), ("status",)],
     lambda r: (_get(r, "ca_id", "action_id"),), _action, False),
    ("ca_elections.csv", [("election_id",), ("ca_id", "action_id"), ("portfolio_id",), ("election_type",)],
     lambda r: (_get(r, "election_id"),), _election, False),
    ("users.csv", [("user_id",), ("role",)],
     lambda r: (_get(r, "user_id"),), _user, True),
]


def _run(db: Session, ctx: dict, spec) -> dict:
    file, required, key_of, builder, optional = spec
    rep = {"file": file, "rows": 0, "loaded": 0, "errors": [], "warnings": []}

    path = config.DATA_DIR / file
    if not path.exists():
        (rep["warnings"] if optional else rep["errors"]).append(f"file not found in {config.DATA_DIR}")
        return rep

    df = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    df.columns = [c.strip().lower() for c in df.columns]
    missing = [alias[0] for alias in required if not any(c in df.columns for c in alias)]
    if missing:
        rep["errors"].append(f"missing column(s): {', '.join(missing)}")
        return rep

    seen, objs = set(), []
    for line, row in enumerate(df.to_dict("records"), start=2):     # line 1 is the header
        rep["rows"] += 1
        try:
            key = key_of(row)
            if None not in key and key in seen:
                raise ValueError(f"duplicate row {key}")
            obj = builder(row, ctx)
            seen.add(key)
            objs.append(obj)
            msg = getattr(obj, "status_message", None)
            if msg:
                rep["warnings"].append(f"row {line}: {msg}")
        except ValueError as e:
            rep["errors"].append(f"row {line}: {e}")

    db.add_all(objs)
    db.flush()
    rep["loaded"] = len(objs)
    return rep


def load_all(db: Session) -> list:
    """Import every CSV in data/. Returns one report dict per file."""
    if db.query(Portfolio).first() is not None:
        raise RuntimeError("Data is already loaded. Run 'python -m database.seed --reset' to wipe and reload.")

    ctx = {"securities": set(), "portfolios": {}, "actions": set()}
    report = []
    try:
        for spec in DATASETS:
            rep = _run(db, ctx, spec)
            log.info("%s: %s/%s rows loaded, %s errors, %s warnings", rep["file"], rep["loaded"],
                     rep["rows"], len(rep["errors"]), len(rep["warnings"]))
            report.append(rep)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return report