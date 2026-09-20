from sqlalchemy import BigInteger, Column, Date, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import JSONB

from database.db import Base, Money


class CaProcessing(Base):
    __tablename__ = "ca_processing"
    __table_args__ = {"schema": "corporate_actions"}

    processing_id = Column(BigInteger, primary_key=True, autoincrement=True)
    ca_id = Column(String, nullable=False)
    portfolio_id = Column(String, ForeignKey("corporate_actions.portfolios.portfolio_id"), nullable=False)
    security_id = Column(String, ForeignKey("corporate_actions.securities.security_id"), nullable=False)
    election_id = Column(String)
    status = Column(String, nullable=False)
    processing_date = Column(DateTime(timezone=True), nullable=False)
    effective_date = Column(Date, nullable=False)
    rule_applied = Column(String, nullable=False)
    rule_version = Column(String, nullable=False)
    eligible_qty = Column(Money)
    eligibility_date = Column(Date)
    before_quantity = Column(Money)
    after_quantity = Column(Money)
    before_avg_cost = Column(Money)
    after_avg_cost = Column(Money)
    before_cost_basis = Column(Money)
    after_cost_basis = Column(Money)
    currency = Column(String, nullable=False)
    before_cash = Column(Money)
    cash_movement = Column(Money, nullable=False)
    after_cash = Column(Money)
    before_market_value = Column(Money)
    after_market_value = Column(Money)
    before_receivable_value = Column(Money)
    after_receivable_value = Column(Money)
    reconciliation_difference = Column(Money)
    expected_leakage = Column(Money)
    before_state = Column(JSONB, nullable=False)
    after_state = Column(JSONB, nullable=False)
    error_reason = Column(String)
    processed_by = Column(String, ForeignKey("corporate_actions.users.user_id"), nullable=False)
    reversal_of = Column(BigInteger, ForeignKey("corporate_actions.ca_processing.processing_id"))
    reversal_reason = Column(String)
    created_at = Column(DateTime(timezone=True), nullable=False)
