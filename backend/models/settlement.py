from sqlalchemy import BigInteger, Column, Date, String, ForeignKey, DateTime

from database.db import Base, Money


class Settlement(Base):
    __tablename__ = "settlements"
    __table_args__ = {"schema": "corporate_actions"}

    settlement_id = Column(BigInteger, primary_key=True, autoincrement=True)
    processing_id = Column(BigInteger, ForeignKey("corporate_actions.ca_processing.processing_id"), nullable=False)
    portfolio_id = Column(String, ForeignKey("corporate_actions.portfolios.portfolio_id"), nullable=False)
    security_id = Column(String, ForeignKey("corporate_actions.securities.security_id"))
    leg_code = Column(String, nullable=False)
    settlement_type = Column(String, nullable=False)
    quantity_movement = Column(Money, nullable=False)
    cash_movement = Column(Money, nullable=False)
    currency = Column(String, nullable=False)
    recognition_date = Column(Date, nullable=False)
    settlement_date = Column(Date, nullable=False)
    settled_at = Column(DateTime(timezone=True))
    status = Column(String, nullable=False)
    cost_basis_movement = Column(Money)
    reversal_of = Column(BigInteger, ForeignKey("corporate_actions.settlements.settlement_id"))
