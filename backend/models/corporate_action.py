from sqlalchemy import Column, Date, SmallInteger, String, ForeignKey

from database.db import Base, Money


class CorporateActionEvent(Base):
    __tablename__ = "corporate_action_events"
    __table_args__ = {"schema": "corporate_actions"}

    ca_id = Column(String, primary_key=True)
    security_id = Column(String, ForeignKey("corporate_actions.securities.security_id"), nullable=False)
    action_type = Column(String, nullable=False)
    tier = Column(SmallInteger, nullable=False)
    status = Column(String, nullable=False)
    ex_date = Column(Date, nullable=False)
    record_date = Column(Date)
    pay_date = Column(Date)
    election_deadline = Column(Date)
    ratio_numerator = Column(Money)
    ratio_denominator = Column(Money)
    cash_rate_per_share = Column(Money)
    subscription_price = Column(Money)
    offer_price = Column(Money)
    new_security_id = Column(String, ForeignKey("corporate_actions.securities.security_id"))
    cost_basis_allocation_pct = Column(Money)
    tax_withholding_pct = Column(Money)
    notes = Column(String)