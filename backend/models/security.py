from sqlalchemy import Column, String

from database.db import Base


class Security(Base):
    __tablename__ = "securities"

    security_id = Column(String(20), primary_key=True)
    security_name = Column(String(200), nullable=False)
    ticker = Column(String(20))                       # symbol in the CSV
    security_type = Column(String(30))                # "type" in the CSV
    currency = Column(String(3))
    underlying_security_id = Column(String(20))       # "underlying" in the CSV
    status = Column(String(20))