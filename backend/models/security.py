from sqlalchemy import Column, String
from sqlalchemy.orm import relationship

from database.db import Base


class Security(Base):
    __tablename__ = "securities"
    __table_args__ = {"schema": "corporate_actions"}

    security_id = Column(String, primary_key=True)
    symbol = Column(String, nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    currency = Column(String, nullable=False)
    underlying_security_id = Column(String)
    status = Column(String, nullable=False)