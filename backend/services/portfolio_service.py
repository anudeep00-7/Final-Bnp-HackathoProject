"""
portfolio_service.py

All data comes from Supabase PostgreSQL via SQLAlchemy.
No CSV files are read at runtime.
"""

from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from models.portfolio import Portfolio
from models.position import Position
from models.security import Security
from models.cash_balance import CashBalance
from models.price import Price
from models.user_portfolio import UserPortfolio


def get_portfolios(db: Session, user=None) -> list:
    """Return all portfolios visible to the user (admin = all, analyst = assigned)."""
    q = db.query(Portfolio)
    if user and getattr(user, "role", "ADMIN") != "ADMIN":
        assigned = [
            r.portfolio_id
            for r in db.query(UserPortfolio).filter_by(user_id=user.user_id).all()
        ]
        if not assigned:
            return []
        q = q.filter(Portfolio.portfolio_id.in_(assigned))

    portfolios = q.all()
    result = []
    for pf in portfolios:
        # Fetch current cash balance (latest as_of_date per currency)
        cash_rows = (
            db.query(CashBalance)
            .filter_by(portfolio_id=pf.portfolio_id)
            .order_by(CashBalance.as_of_date.desc())
            .all()
        )
        cash_summary = {r.currency: float(r.balance) for r in cash_rows}
        total_cash = sum(cash_summary.values())

        result.append({
            "portfolio_id": pf.portfolio_id,
            "portfolio_name": pf.portfolio_name,
            "client_id": pf.client_id,
            "client_type": pf.client_type,
            "base_currency": pf.base_currency,
            "cash_balances": cash_summary,
            "total_cash": round(total_cash, 6),
        })
    return result


def get_holdings(db: Session, portfolio_id: str, as_of: Optional[date] = None) -> list:
    """
    Return latest position for each security in the portfolio, enriched with
    security metadata and the most-recent price.
    """
    # Latest position per (portfolio, security) = the row with the max as_of_date
    from sqlalchemy import func

    # subquery: max date per portfolio/security pair
    latest_dates = (
        db.query(
            Position.portfolio_id,
            Position.security_id,
            func.max(Position.as_of_date).label("max_date"),
        )
        .filter(Position.portfolio_id == portfolio_id)
        .group_by(Position.portfolio_id, Position.security_id)
        .subquery()
    )

    positions = (
        db.query(Position)
        .join(
            latest_dates,
            (Position.portfolio_id == latest_dates.c.portfolio_id)
            & (Position.security_id == latest_dates.c.security_id)
            & (Position.as_of_date == latest_dates.c.max_date),
        )
        .all()
    )

    if not positions:
        return []

    sec_ids = [p.security_id for p in positions]
    securities = {
        s.security_id: s
        for s in db.query(Security).filter(Security.security_id.in_(sec_ids)).all()
    }

    # Latest price per security
    latest_price_sub = (
        db.query(
            Price.security_id,
            func.max(Price.price_date).label("max_date"),
        )
        .filter(Price.security_id.in_(sec_ids))
        .group_by(Price.security_id)
        .subquery()
    )
    price_rows = (
        db.query(Price)
        .join(
            latest_price_sub,
            (Price.security_id == latest_price_sub.c.security_id)
            & (Price.price_date == latest_price_sub.c.max_date),
        )
        .all()
    )
    prices = {p.security_id: float(p.close_price) for p in price_rows}

    holdings = []
    for pos in positions:
        sec = securities.get(pos.security_id)
        price = prices.get(pos.security_id)
        qty = float(pos.qty)
        cost = float(pos.avg_cost)
        cost_basis = round(qty * cost, 6)
        market_value = round(qty * price, 6) if price is not None else None
        pnl = round(market_value - cost_basis, 6) if market_value is not None else None

        holdings.append({
            "portfolio_id": pos.portfolio_id,
            "security_id": pos.security_id,
            "name": sec.name if sec else pos.security_id,
            "symbol": sec.symbol if sec else None,
            "type": sec.type if sec else None,
            "currency": sec.currency if sec else None,
            "qty": qty,
            "avg_cost": cost,
            "as_of_date": pos.as_of_date.isoformat() if pos.as_of_date else None,
            "latest_price": price,
            "cost_basis": cost_basis,
            "market_value": market_value,
            "unrealised_pnl": pnl,
        })
    return holdings


def get_cash_balances(db: Session, portfolio_id: str) -> list:
    """Return all cash balance rows for the portfolio (latest per currency)."""
    from sqlalchemy import func

    latest_sub = (
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
            latest_sub,
            (CashBalance.portfolio_id == latest_sub.c.portfolio_id)
            & (CashBalance.currency == latest_sub.c.currency)
            & (CashBalance.as_of_date == latest_sub.c.max_date),
        )
        .all()
    )
    return [
        {
            "portfolio_id": r.portfolio_id,
            "currency": r.currency,
            "balance": float(r.balance),
            "as_of_date": r.as_of_date.isoformat() if r.as_of_date else None,
        }
        for r in rows
    ]