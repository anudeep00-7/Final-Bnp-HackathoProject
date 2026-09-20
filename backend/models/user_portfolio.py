from sqlalchemy import Column, String, ForeignKey

from database.db import Base


class UserPortfolio(Base):
    __tablename__ = "user_portfolios"
    __table_args__ = {"schema": "corporate_actions"}

    user_id = Column(String, ForeignKey("corporate_actions.users.user_id"), primary_key=True)
    portfolio_id = Column(String, ForeignKey("corporate_actions.portfolios.portfolio_id"), primary_key=True)
