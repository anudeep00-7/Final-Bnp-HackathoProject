from sqlalchemy import Column, Date, String

from database.db import Base, Money


class Portfolio(Base):
    __tablename__ = "portfolios"

    portfolio_id = Column(String(20), primary_key=True)
    portfolio_name = Column(String(200), nullable=False)
    client_id = Column(String(20))
    client_type = Column(String(50))
    base_currency = Column(String(3))
    cash_balance = Column(Money, nullable=False, default=0)   # current cash
    opening_cash = Column(Money, default=0)                   # cash on 2026-01-01
    cash_as_of = Column(Date)