"""
portfolio_routes.py

Serves portfolio, holdings, and cash-balance data from the database.
No CSV dependencies.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.db import get_db
from routes.auth_routes import get_current_user, can_view_portfolio
from services import portfolio_service

router = APIRouter(tags=["portfolios"])


@router.get("/portfolios")
def get_portfolios(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return portfolio_service.get_portfolios(db, user)


@router.get("/portfolios/{portfolio_id}")
def get_portfolio_detail(
    portfolio_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not can_view_portfolio(user, portfolio_id, db):
        raise HTTPException(403, "Not authorised to view this portfolio")
    portfolios = portfolio_service.get_portfolios(db, None)
    match = next((p for p in portfolios if p["portfolio_id"] == portfolio_id), None)
    if not match:
        raise HTTPException(404, f"Portfolio {portfolio_id} not found")
    return match


@router.get("/holdings/{portfolio_id}")
def get_holdings(
    portfolio_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not can_view_portfolio(user, portfolio_id, db):
        raise HTTPException(403, "Not authorised to view this portfolio")
    return portfolio_service.get_holdings(db, portfolio_id)


@router.get("/cash/{portfolio_id}")
def get_cash(
    portfolio_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not can_view_portfolio(user, portfolio_id, db):
        raise HTTPException(403, "Not authorised to view this portfolio")
    return portfolio_service.get_cash_balances(db, portfolio_id)