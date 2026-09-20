from sqlalchemy import Column, Date, String, ForeignKey

from database.db import Base, Money


class Price(Base):
    __tablename__ = "prices"
    __table_args__ = {"schema": "corporate_actions"}

    security_id = Column(String, ForeignKey("corporate_actions.securities.security_id"), primary_key=True)
    price_date = Column(Date, primary_key=True)
    close_price = Column(Money, nullable=False)
    note = Column(String)