from fastapi import APIRouter
from services.portfolio_service import PortfolioService

router = APIRouter()

portfolio_service = PortfolioService()

@router.get("/portfolios")
def get_portfolios():
    return portfolio_service.get_portfolios()

@router.get("/holdings/{portfolio_id}")
def get_holdings(portfolio_id: str):
    return portfolio_service.get_holdings(portfolio_id)