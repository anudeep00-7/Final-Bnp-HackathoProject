from sqlalchemy import Column, Date, String, ForeignKey

from database.db import Base, Money


class CaElection(Base):
    __tablename__ = "ca_elections"
    __table_args__ = {"schema": "corporate_actions"}

    election_id = Column(String, primary_key=True)
    ca_id = Column(String, ForeignKey("corporate_actions.corporate_action_events.ca_id"), nullable=False)
    portfolio_id = Column(String, ForeignKey("corporate_actions.portfolios.portfolio_id"), nullable=False)
    election_type = Column(String, nullable=False)
    elected_qty = Column(Money)
    election_date = Column(Date, nullable=False)
    status = Column(String, nullable=False)
    notes = Column(String)