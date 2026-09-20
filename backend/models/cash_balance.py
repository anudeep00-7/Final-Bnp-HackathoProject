from sqlalchemy import Column, Date, String, ForeignKey

from database.db import Base, Money


class CashBalance(Base):
    __tablename__ = "cash_balances"
    __table_args__ = {"schema": "corporate_actions"}

    portfolio_id = Column(String, ForeignKey("corporate_actions.portfolios.portfolio_id"), primary_key=True)
    currency = Column(String, primary_key=True)
    balance = Column(Money, nullable=False)
    as_of_date = Column(Date, primary_key=True)
