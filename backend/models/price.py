from sqlalchemy import Column, Date, ForeignKey, Integer, String

from database.db import Base, Money


class Price(Base):
    __tablename__ = "prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    security_id = Column(String(20), ForeignKey("securities.security_id"), nullable=False, index=True)
    price_date = Column(Date, nullable=False, index=True)
    close_price = Column(Money, nullable=False)
    note = Column(String(300))