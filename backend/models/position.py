from sqlalchemy import Column, Date, String, ForeignKey

from database.db import Base, Money


class Position(Base):
    __tablename__ = "positions"
    __table_args__ = {"schema": "corporate_actions"}

    portfolio_id = Column(String, ForeignKey("corporate_actions.portfolios.portfolio_id"), primary_key=True)
    security_id = Column(String, ForeignKey("corporate_actions.securities.security_id"), primary_key=True)
    qty = Column(Money, nullable=False)
    avg_cost = Column(Money, nullable=False)
    as_of_date = Column(Date, primary_key=True)