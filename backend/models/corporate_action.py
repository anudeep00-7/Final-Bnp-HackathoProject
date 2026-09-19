from sqlalchemy import CheckConstraint, Column, Date, ForeignKey, Integer, String, Text

from database.db import Base, Money


class CorporateAction(Base):
    __tablename__ = "corporate_actions"
    __table_args__ = (
        CheckConstraint("status IN ('PENDING','PROCESSED','REJECTED','FAILED')",
                        name="ck_action_status"),
    )

    action_id = Column(String(20), primary_key=True)                   # ca_id in the CSV
    security_id = Column(String(20), ForeignKey("securities.security_id"), nullable=False, index=True)
    action_type = Column(String(40), nullable=False)
    tier = Column(Integer)
    status = Column(String(20), nullable=False, default="PENDING")     # processing status
    status_message = Column(Text)                                      # reason / warning
    source_status = Column(String(20))                                 # raw CSV status (ACTIVE...)

    ex_date = Column(Date)
    record_date = Column(Date)
    payment_date = Column(Date)                                        # pay_date in the CSV
    election_deadline = Column(Date)

    ratio_num = Column(Money)
    ratio_den = Column(Money)
    cash_rate = Column(Money)
    subscription_price = Column(Money)
    offer_price = Column(Money)
    new_security_id = Column(String(20))
    new_name = Column(String(200))                                     # for NAME_CHANGE
    cost_basis_pct = Column(Money)
    tax_withholding_pct = Column(Money)
    notes = Column(Text)