from sqlalchemy import Boolean, Column, DateTime, String, text

from database.db import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "corporate_actions"}

    user_id = Column(String, primary_key=True)
    display_name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    auth_subject = Column(String, unique=True)
    is_active = Column(Boolean, nullable=False, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("clock_timestamp()"))