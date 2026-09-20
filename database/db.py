from sqlalchemy import Numeric, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

import config

if not config.DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Copy .env.example to .env and fill it in.")

engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# Exact NUMERIC in PostgreSQL, float in Python (matches the team doc's float fields)
Money = Numeric(20, 6, asdecimal=False)


def get_db():
    """FastAPI dependency: one session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def import_models():
    from models import (audit_log, ca_election, corporate_action, portfolio,  # noqa: F401
                        position, price, security, user)


def init_db():
    """Create any missing tables."""
    import_models()
    Base.metadata.create_all(bind=engine)