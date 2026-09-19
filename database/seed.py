import argparse
import logging

from database.db import Base, SessionLocal, engine, import_models, init_db
from backend.models.portfolio import Portfolio
from backend.models.user import User
from backend.services.csv_loader import load_all

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def seed_default_users(db) -> bool:
    """Only used when there is no users.csv. Replace with real users if you have them."""
    if db.query(User).first() is not None:
        return False
    ids = sorted(p.portfolio_id for p in db.query(Portfolio).all())
    half = (len(ids) + 1) // 2
    db.add_all([
        User(user_id="U001", name="Admin", role="ADMIN", portfolio_id="ALL"),
        User(user_id="U002", name="Analyst One", role="ANALYST", portfolio_id=",".join(ids[:half])),
        User(user_id="U003", name="Analyst Two", role="ANALYST", portfolio_id=",".join(ids[half:])),
    ])
    db.commit()
    return True


def main():
    parser = argparse.ArgumentParser(description="Create tables and import the CSV data")
    parser.add_argument("--reset", action="store_true", help="drop all tables first")
    args = parser.parse_args()

    if args.reset:
        import_models()
        Base.metadata.drop_all(engine)
    init_db()

    with SessionLocal() as db:
        report = load_all(db)
        added = seed_default_users(db)

    print("\nImport summary")
    for r in report:
        print(f"  {r['file']:<24} rows={r['rows']:<4} loaded={r['loaded']:<4} "
              f"errors={len(r['errors'])} warnings={len(r['warnings'])}")
        for msg in r["errors"]:
            print(f"      ERROR   {msg}")
        for msg in r["warnings"]:
            print(f"      WARNING {msg}")
    if added:
        print("  default users created: U001 (Admin), U002 and U003 (Analysts)")


if __name__ == "__main__":
    main()