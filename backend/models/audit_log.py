from sqlalchemy import JSON, Column, String

from database.db import Base, Money


class AuditLog(Base):
    __tablename__ = "audit_log"

    audit_id = Column(String(40), primary_key=True)
    action_id = Column(String(20), nullable=False, index=True)      # no foreign key on purpose
    portfolio_id = Column(String(20), nullable=False, index=True)   # "ALL" for rejected/failed records
    before_state = Column(JSON)
    after_state = Column(JSON)
    rule_applied = Column(String(300))
    cash_movement = Column(Money, default=0)
    timestamp = Column(String(40), nullable=False)                  # ISO string