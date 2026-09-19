from sqlalchemy import Column, Date, ForeignKey, String

from database.db import Base, Money


class CaElection(Base):
    __tablename__ = "ca_elections"

    election_id = Column(String(20), primary_key=True)
    action_id = Column(String(20), ForeignKey("corporate_actions.action_id"), nullable=False, index=True)
    portfolio_id = Column(String(20), ForeignKey("portfolios.portfolio_id"), nullable=False, index=True)
    election_type = Column(String(20), nullable=False)
    elected_qty = Column(Money)
    election_date = Column(Date)
    status = Column(String(20))
    notes = Column(String(500))