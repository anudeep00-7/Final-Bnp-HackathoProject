from sqlalchemy import Column, Date, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import JSONB

from database.db import Base, Money


class EventTerm(Base):
    __tablename__ = "event_terms"
    __table_args__ = {"schema": "corporate_actions"}

    ca_id = Column(String, ForeignKey("corporate_actions.corporate_action_events.ca_id"), primary_key=True)
    announcement_date = Column(Date)
    parent_ca_id = Column(String, ForeignKey("corporate_actions.corporate_action_events.ca_id"))
    supersedes_ca_id = Column(String, ForeignKey("corporate_actions.corporate_action_events.ca_id"))
    new_name = Column(String)
    new_symbol = Column(String)
    reinvestment_price = Column(Money)
    tender_cap_pct = Column(Money)
    policy = Column(JSONB, nullable=False)
    processing_block_reason = Column(String, nullable=False)
    reviewed_by = Column(String, ForeignKey("corporate_actions.users.user_id"))
    reviewed_at = Column(DateTime(timezone=True))
    provenance = Column(String, nullable=False)
