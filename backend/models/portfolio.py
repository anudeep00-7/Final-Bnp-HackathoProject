from sqlalchemy import Column, String

from database.db import Base


class Portfolio(Base):
    __tablename__ = "portfolios"
    __table_args__ = {"schema": "corporate_actions"}

    portfolio_id = Column(String, primary_key=True)
    portfolio_name = Column(String, nullable=False)
    client_id = Column(String, nullable=False)
    client_type = Column(String, nullable=False)
    base_currency = Column(String, nullable=False)