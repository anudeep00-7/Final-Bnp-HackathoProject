from sqlalchemy import Column, String

from database.db import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(String(20), primary_key=True)
    name = Column(String(100), nullable=False)
    role = Column(String(10), nullable=False)          # ADMIN or ANALYST
    portfolio_id = Column(String(200))                 # "ALL" for admin, "P001,P002" for analyst