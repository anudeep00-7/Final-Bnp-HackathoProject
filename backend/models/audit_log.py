from sqlalchemy import BigInteger, Column, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import JSONB

from database.db import Base, Money


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = {"schema": "corporate_actions"}

    audit_id = Column(BigInteger, primary_key=True, autoincrement=True)
    processing_id = Column(BigInteger, ForeignKey("corporate_actions.ca_processing.processing_id"), nullable=False)
    ca_id = Column(String, ForeignKey("corporate_actions.corporate_action_events.ca_id"), nullable=False)
    security_id = Column(String, ForeignKey("corporate_actions.securities.security_id"), nullable=False)
    portfolio_id = Column(String, ForeignKey("corporate_actions.portfolios.portfolio_id"), nullable=False)
    action = Column(String, nullable=False)
    outcome = Column(String, nullable=False)
    processing_date = Column(DateTime(timezone=True), nullable=False)
    rule_applied = Column(String, nullable=False)
    before_state = Column(JSONB, nullable=False)
    after_state = Column(JSONB, nullable=False)
    cash_movement = Column(Money, nullable=False)
    performed_by = Column(String, ForeignKey("corporate_actions.users.user_id"), nullable=False)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    reason = Column(String)
    reversal_of = Column(BigInteger, ForeignKey("corporate_actions.audit_logs.audit_id"))