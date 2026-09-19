import re
from pathlib import Path
from typing import Optional

from dateutil import parser as dateparser

NUMBER = r"\d+(?:\.\d+)?"
CCY_PRE = r"(?:\b(?:USD|EUR|GBP|INR)|US\$|\$)"
CCY_POST = r"(?:USD|EUR|GBP|INR)\b"
MONEY = rf"(?:{CCY_PRE}\s*(?P<a>{NUMBER})|(?P<b>{NUMBER})\s*{CCY_POST})"
PCT = rf"({NUMBER})\s*(?:pct|%|percent)"
DATE = (r"(\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?,?\s+\d{4}"
        r"|[A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})")

# order matters: most specific first
TYPE_RULES = [
    ("REVERSE_SPLIT", r"reverse\s+(?:stock\s+)?split|share\s+consolidation"),
    ("STOCK_SPLIT", r"stock\s+split|share\s+split|\bsplit\b"),
    ("NAME_CHANGE", r"name\s+change|changed\s+its\s+name|\brenam|rebrand"),
    ("BONUS_ISSUE", r"bonus"),
    ("RIGHTS_ISSUE", r"rights\s+(?:issue|offering)"),
    ("TENDER_OFFER", r"tender"),
    ("SPIN_OFF", r"spin[\s-]?off|spins?\s+off"),
    ("MERGER", r"merger|amalgamat|acquired\s+by|acquisition"),
    ("DELISTING", r"delist"),
    ("CONVERSION", r"convertible|convert(?:s|ed)?\s+into|conversion"),
    ("DRIP", r"\bdrip\b|dividend\s+reinvestment"),
    ("STOCK_DIVIDEND", r"stock\s+dividend|scrip"),
    ("CASH_DIVIDEND", r"dividend"),
]
RATIO_TYPES = {"STOCK_SPLIT", "REVERSE_SPLIT", "BONUS_ISSUE", "RIGHTS_ISSUE", "MERGER",
               "SPIN_OFF", "CONVERSION", "STOCK_DIVIDEND"}
REQUIRED = {
    "CASH_DIVIDEND": ["cash_rate"], "STOCK_SPLIT": ["ratio_num", "ratio_den"],
    "REVERSE_SPLIT": ["ratio_num", "ratio_den"], "BONUS_ISSUE": ["ratio_num", "ratio_den"],
    "STOCK_DIVIDEND": ["ratio_num", "ratio_den"], "RIGHTS_ISSUE": ["ratio_num", "ratio_den", "subscription_price"],
    "TENDER_OFFER": ["offer_price"], "MERGER": ["ratio_num", "ratio_den"],
    "SPIN_OFF": ["ratio_num", "ratio_den"], "DELISTING": ["cash_rate"],
    "CONVERSION": ["ratio_num", "ratio_den"], "DRIP": ["reinvestment_price"], "NAME_CHANGE": ["new_name"],
}
DATE_FIELDS = {
    "ex_date": r"ex[-\s]?(?:dividend\s+)?date",
    "record_date": r"record\s+date",
    "pay_date": r"pay(?:ment)?\s+date|payable(?:\s+on)?|paid\s+on",
    "election_deadline": r"election\s+deadline|elect(?:ion)?\s+by|deadline",
}


def load_securities(path: Optional[str] = None) -> list:
    import pandas as pd
    path = path or Path(__file__).resolve().parents[1] / "data" / "securities.csv"
    return pd.read_csv(path).to_dict("records")


def _detect_type(t):
    for name, rx in TYPE_RULES:
        if re.search(rx, t, re.I):
            return name
    return None


def _money(text, before=""):
    m = re.search(before + MONEY, text, re.I | re.S)
    return float(m.group("a") or m.group("b")) if m else None


def _pct(text, pattern):
    m = re.search(pattern, text, re.I)
    val = next((g for g in m.groups() if g), None) if m else None
    return float(val) if val else None


def _ratio(t):
    m = re.search(rf"({NUMBER})\s*-?\s*for\s*-?\s*({NUMBER})", t, re.I)          # 2-for-1
    if not m:
        m = re.search(rf"\b({NUMBER})\s*:\s*({NUMBER})\b", t)                    # 1:5
    if not m:                                                                     # 1 bonus share per 5 held
        m = re.search(rf"({NUMBER})\s+(?:[A-Za-z-]+\s+){{0,2}}?shares?\b.{{0,60}}?\bper\s+({NUMBER})", t, re.I)
    if m:
        return float(m.group(1)), float(m.group(2))
    m = re.search(rf"({NUMBER})\s+shares?\s+per\s+(?:bond|unit|preference|share)", t, re.I)
    return (float(m.group(1)), 1.0) if m else (None, None)


def _dates(t):
    out = {}
    for field, label in DATE_FIELDS.items():
        m = re.search(rf"(?:{label})\s*(?:is|of|on|:|-)?\s*{DATE}", t, re.I)
        value = None
        if m:
            try:
                value = dateparser.parse(m.group(1)).date().isoformat()
            except (ValueError, OverflowError):
                pass
        out[field] = value
    return out


def _new_name(t):
    m = re.search(r"(?i:renamed|changed\s+its\s+name|name\s+change|rebrand\w*)\s*(?i:to|as|into|:)\s*"
                  r"([A-Z][\w&.'\- ]{1,60}?)(?=[.,;]|\s+(?i:effective|with|from|on)\b|$)", t)
    return m.group(1).strip() if m else None


def _match_securities(text, securities):
    low, hits = text.lower(), {}
    for s in securities or []:
        name = str(s.get("name") or s.get("security_name") or "").strip()
        sym = str(s.get("symbol") or s.get("ticker") or "").strip()
        cands = []
        if name and name.lower() in low:
            cands.append((low.index(name.lower()), -len(name)))
        if sym:
            m = re.search(rf"\b{re.escape(sym)}\b", text)
            if m:
                cands.append((m.start(), -len(sym)))
        if cands:
            hits[s.get("security_id")] = min(cands)
    return [sid for sid, _ in sorted(hits.items(), key=lambda kv: kv[1])]


def extract_notice(text: str, securities: Optional[list] = None) -> dict:
    t = " ".join((text or "").split())
    a_type = _detect_type(t)
    num, den = _ratio(t) if a_type in RATIO_TYPES else (None, None)
    ccy = re.search(r"\b(USD|EUR|GBP|INR)\b", t)
    hits = _match_securities(t, securities)

    out = {
        "action_type": a_type,
        "security_id": hits[0] if hits else None,
        "new_security_id": hits[1] if len(hits) > 1 and a_type in {"MERGER", "SPIN_OFF", "CONVERSION"} else None,
        "currency": ccy.group(1) if ccy else ("USD" if "$" in t else None),
        "ratio_num": num, "ratio_den": den,
        "cash_rate": _money(t) if a_type in {"CASH_DIVIDEND", "MERGER", "DELISTING"} else None,
        "subscription_price": _money(t, r"subscription\s+price.{0,25}?") if a_type == "RIGHTS_ISSUE" else None,
        "offer_price": _money(t, r"\bat\s+") if a_type == "TENDER_OFFER" else None,
        "reinvestment_price": _money(t, r"reinvest\w*.{0,60}?") if a_type == "DRIP" else None,
        "cost_basis_pct": _pct(t, rf"{PCT}\s+of\s+(?:the\s+)?parent") if a_type == "SPIN_OFF" else None,
        "cap_pct": _pct(t, rf"cap(?:ped)?\s+(?:at\s+|of\s+)?{PCT}") if a_type == "TENDER_OFFER" else None,
        "tax_withholding_pct": _pct(t, rf"withh\w*(?:\s+tax)?\D{{0,15}}?{PCT}|{PCT}\s+withh"),
        "new_name": _new_name(t) if a_type == "NAME_CHANGE" else None,
        **_dates(t),
    }
    required = REQUIRED.get(a_type, []) + (["security_id"] if securities else [])
    missing = [f for f in required if out.get(f) in (None, "")]
    out["missing_fields"] = missing
    out["confidence"] = round(1 - len(missing) / max(len(required), 1), 2) if a_type else 0.0
    out["needs_review"] = a_type is None or bool(missing)
    return out


if __name__ == "__main__":
    samples = [
        "Q1 dividend GlobalBank Corp - USD 0.50 per share, ex-date 2026-03-12, payable 2026-03-20",
        "1 bonus share per 5 held Apex Pharma",
        "1-for-4 rights issue Cascade Materials at subscription price USD 8.00",
        "Northwind Industries acquired by Acquirer Corp - 3 AQC shares + USD 2.00 cash per 4 NWI shares held",
    ]
    secs = load_securities()
    for s in samples:
        print(extract_notice(s, secs), "\n")