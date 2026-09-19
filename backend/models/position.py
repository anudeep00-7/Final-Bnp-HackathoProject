from sqlalchemy import Column, Date, ForeignKey, String

from database.db import Base, Money


class Position(Base):
    __tablename__ = "positions"

    portfolio_id = Column(String(20), ForeignKey("portfolios.portfolio_id"), primary_key=True)
    security_id = Column(String(20), ForeignKey("securities.security_id"), primary_key=True)
    quantity = Column(Money, nullable=False)          # current quantity
    avg_cost = Column(Money, nullable=False)          # current average cost
    opening_quantity = Column(Money)                  # 2026-01-01 values, never changed
    opening_avg_cost = Column(Money)
    as_of_date = Column(Date)