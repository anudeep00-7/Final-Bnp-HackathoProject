#!/usr/bin/env python3
"""
seed_supabase.py
ActiLedger → Supabase Seeding Script

Loads CSV fixture data into the corporate_actions schema on Supabase PostgreSQL.
Respects FK dependency order. Reports every row attempted, inserted, rejected,
duplicate, FK-failed, and validation-failed.

USAGE:
    Set DATABASE_URL in backend/.env, then run from repo root:
    python backend/supabase_migration/seed_supabase.py --source-dir "path/to/csv/dir"

    Or with the fixture copies:
    python backend/supabase_migration/seed_supabase.py \
        --source-dir "database/outputs/tests/fixtures" --repairs known

SAFETY:
    - Read-only until you confirm with --execute flag.
    - Without --execute, runs in DRY-RUN mode and only validates CSVs.
    - Never prints or logs DATABASE_URL or any credentials.
    - Uses parameterized queries only (no string interpolation of data).

REQUIREMENTS:
    pip install psycopg[binary]
    (or psycopg2-binary as fallback)

DO NOT SEED ca_notices_raw.csv — it is for AI/NLP testing only,
not for the transactional database.
"""

import argparse
import os
import sys
from decimal import Decimal
from pathlib import Path

# ── locate the project root and add scripts to path ──────────────────────────
REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = REPO_ROOT / "database" / "outputs" / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

try:
    from validate_csvs import validate, ORDER, CONTRACT
except ImportError:
    print("ERROR: Cannot import validate_csvs. "
          "Run from repo root or ensure database/outputs/scripts/ is on path.")
    sys.exit(1)

SCHEMA = "corporate_actions"

# ── FK dependency order for seeding ──────────────────────────────────────────
# This is the only safe insertion order given FK constraints.
SEED_ORDER = [
    "securities",           # no FK deps (self-FK handled by topological sort below)
    "portfolios",           # no FK deps
    "positions",            # FK: portfolio_id, security_id
    "cash_balances",        # FK: portfolio_id
    "prices",               # FK: security_id
    "corporate_action_events",  # FK: security_id, new_security_id (optional)
    "event_terms",          # FK: ca_id, parent_ca_id, supersedes_ca_id, reviewed_by
    "ca_elections",         # FK: ca_id, portfolio_id
]

# ── Column mappings: CSV column name → DB column name (where they differ) ────
COLUMN_MAP = {
    # All tables use identical column names as the DDL, so no remapping needed.
    # This dict is a safety net for future mismatches.
    "securities": {},
    "portfolios": {},
    "positions": {"qty": "qty", "avg_cost": "avg_cost"},
    "cash_balances": {},
    "prices": {},
    "corporate_action_events": {},
    "event_terms": {},
    "ca_elections": {},
}

# ── Columns to insert per table (subset of CSV headers used in DB) ────────────
DB_COLUMNS = {
    "securities": [
        "security_id", "symbol", "name", "type", "currency",
        "underlying_security_id", "status"
    ],
    "portfolios": [
        "portfolio_id", "portfolio_name", "client_id", "client_type", "base_currency"
    ],
    "positions": [
        "portfolio_id", "security_id", "qty", "avg_cost", "as_of_date"
    ],
    "cash_balances": [
        "portfolio_id", "currency", "balance", "as_of_date"
    ],
    "prices": [
        "security_id", "price_date", "close_price", "note"
    ],
    "corporate_action_events": [
        "ca_id", "security_id", "action_type", "tier", "status",
        "ex_date", "record_date", "pay_date", "election_deadline",
        "ratio_numerator", "ratio_denominator", "cash_rate_per_share",
        "subscription_price", "offer_price", "new_security_id",
        "cost_basis_allocation_pct", "tax_withholding_pct", "notes"
    ],
    "ca_elections": [
        "election_id", "ca_id", "portfolio_id", "election_type",
        "elected_qty", "election_date", "status", "notes"
    ],
}


def _load_env():
    """Load backend/.env without printing any value."""
    env_path = REPO_ROOT / "backend" / ".env"
    if not env_path.exists():
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())


def _get_connection():
    """Return a psycopg connection. Never log the URL."""
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        print("ERROR: DATABASE_URL is not set. "
              "Add it to backend/.env (never pass on command line).")
        sys.exit(1)
    try:
        import psycopg
        conn = psycopg.connect(db_url, autocommit=False)
        print("Connected to Supabase PostgreSQL (psycopg3)")
        return conn, "psycopg3"
    except ImportError:
        pass
    try:
        import psycopg2
        conn = psycopg2.connect(db_url)
        conn.autocommit = False
        print("Connected to Supabase PostgreSQL (psycopg2)")
        return conn, "psycopg2"
    except ImportError:
        print("ERROR: Neither psycopg nor psycopg2 is installed. "
              "Run: pip install psycopg[binary]")
        sys.exit(1)


def _topo_sort_securities(rows):
    """Topological sort so parent securities are inserted before children."""
    ordered, inserted, remaining = [], set(), list(rows)
    while remaining:
        ready = [r for r in remaining
                 if r.get("underlying_security_id") is None
                 or r["underlying_security_id"] in inserted]
        if not ready:
            print("WARNING: Cyclic or missing underlying_security_id reference. "
                  "Inserting remaining rows anyway.")
            ready = remaining
        for r in ready:
            ordered.append(r)
            inserted.add(r["security_id"])
            remaining.remove(r)
    return ordered


def _build_event_terms(ca_rows):
    """
    Derive event_terms rows from corporate_action_events data.
    Mirrors the logic in database/outputs/scripts/import_data.py.
    Every ACTIVE event gets a processing gate by default.
    """
    ca_ids = {r["ca_id"] for r in ca_rows}
    rows = []
    for e in ca_rows:
        ca = e["ca_id"]
        note = e.get("notes") or ""

        # Default: all events are blocked until reviewed
        block = "Eligibility, recognition and rounding policy require review"
        if ca == "CA005":
            block = ("Conflicting cash terms: structured rate 2.00 per share "
                     "versus note 2.00 per four shares")
        if ca == "CA010":
            block = "Confirm linked dividend, reinvestment cash basis, fractions and rounding"

        rows.append({
            "ca_id":                  ca,
            "parent_ca_id":           "CA001" if ca == "CA010" and "CA001" in ca_ids else None,
            "new_name":               "Harbor Retail Group" if ca == "CA014" and "Harbor Retail Group" in note else None,
            "new_symbol":             "HRG" if ca == "CA014" and "HBR to HRG" in note else None,
            "reinvestment_price":     Decimal("42.00") if ca == "CA010" and "42.00" in note else None,
            "tender_cap_pct":         Decimal("30") if ca == "CA009" and "30 pct" in note else None,
            "processing_block_reason": block,
            "provenance":             "D6 notes (proposed terms, not approved); "
                                      "Corporate Action Rules workbook and docs/BUSINESS_RULES.md",
        })
    return rows


def _insert_event_terms(conn, term_rows, driver, report, dry_run):
    """Insert event_terms rows (no CSV source; derived by import logic)."""
    if dry_run:
        report["event_terms"] = {
            "attempted": len(term_rows), "inserted": 0,
            "dry_run": True, "note": "Would insert derived event_terms rows"
        }
        return

    table_report = {
        "attempted": len(term_rows), "inserted": 0,
        "rejected": 0, "errors": []
    }
    cols = [
        "ca_id", "parent_ca_id", "new_name", "new_symbol",
        "reinvestment_price", "tender_cap_pct",
        "processing_block_reason", "provenance"
    ]
    ph = ", ".join(["%s"] * len(cols))
    sql = (f"INSERT INTO {SCHEMA}.event_terms ({', '.join(cols)}) "
           f"VALUES ({ph}) ON CONFLICT (ca_id) DO NOTHING")

    cur = conn.cursor()
    for row in term_rows:
        try:
            values = [row.get(c) for c in cols]
            cur.execute(sql, values)
            table_report["inserted"] += 1
        except Exception as e:
            table_report["rejected"] += 1
            table_report["errors"].append({"ca_id": row.get("ca_id"), "error": str(e)})
    cur.close()
    report["event_terms"] = table_report


def seed(data, conn, driver, dry_run=True):
    """
    Insert validated CSV data into Supabase in FK-safe order.
    Returns a detailed report dict.
    """
    report = {}
    cur = conn.cursor()

    for table in SEED_ORDER:
        if table == "event_terms":
            _insert_event_terms(
                conn, _build_event_terms(data.get("corporate_action_events", [])),
                driver, report, dry_run
            )
            continue

        rows = data.get(table, [])
        if table == "securities":
            rows = _topo_sort_securities(rows)

        table_report = {
            "attempted":   len(rows),
            "inserted":    0,
            "rejected":    0,
            "duplicates":  0,
            "fk_failures": 0,
            "other_errors": 0,
            "errors":      [],
        }

        if dry_run:
            table_report["dry_run"] = True
            report[table] = table_report
            continue

        cols = DB_COLUMNS.get(table, list(rows[0].keys()) if rows else [])
        placeholders = ", ".join(["%s"] * len(cols))
        col_list = ", ".join(cols)
        sql = (f"INSERT INTO {SCHEMA}.{table} ({col_list}) "
               f"VALUES ({placeholders}) ON CONFLICT DO NOTHING RETURNING *")

        for row in rows:
            try:
                values = []
                for c in cols:
                    v = row.get(c)
                    # Convert Decimal to string for psycopg numeric binding
                    if isinstance(v, Decimal):
                        v = str(v)
                    values.append(v)

                cur.execute(sql, values)
                result = cur.fetchone()
                if result is None:
                    # ON CONFLICT DO NOTHING hit — duplicate
                    table_report["duplicates"] += 1
                    table_report["errors"].append({
                        "row_key": {c: row.get(c) for c in CONTRACT.get(table, {}).get("pk", [])},
                        "type": "DUPLICATE",
                    })
                else:
                    table_report["inserted"] += 1

            except Exception as e:
                err_type = type(e).__name__
                err_msg = str(e)
                is_fk = "foreign key" in err_msg.lower() or "fk" in err_type.lower()
                is_dup = "unique" in err_msg.lower() or "duplicate" in err_msg.lower()
                if is_fk:
                    table_report["fk_failures"] += 1
                    table_report["rejected"] += 1
                elif is_dup:
                    table_report["duplicates"] += 1
                    table_report["rejected"] += 1
                else:
                    table_report["other_errors"] += 1
                    table_report["rejected"] += 1
                table_report["errors"].append({
                    "row_key": {c: row.get(c) for c in CONTRACT.get(table, {}).get("pk", [])},
                    "type": "FK_FAILURE" if is_fk else "DUPLICATE" if is_dup else "ERROR",
                    "message": err_msg[:200],
                })
                # After an error, rollback the current savepoint so we can continue
                try:
                    conn.execute("ROLLBACK TO SAVEPOINT seed_row") if hasattr(conn, 'execute') else None
                except Exception:
                    pass

        report[table] = table_report

    cur.close()
    return report


def print_report(report):
    print("\n" + "=" * 70)
    print("SEED REPORT")
    print("=" * 70)
    total_attempted = total_inserted = total_rejected = total_dup = total_fk = 0
    for table, r in report.items():
        attempted = r.get("attempted", 0)
        inserted  = r.get("inserted",  0)
        rejected  = r.get("rejected",  0)
        dup       = r.get("duplicates", 0)
        fk        = r.get("fk_failures", 0)
        dry       = r.get("dry_run", False)
        total_attempted += attempted
        total_inserted  += inserted
        total_rejected  += rejected
        total_dup       += dup
        total_fk        += fk
        status = "DRY-RUN" if dry else ("OK" if not rejected else "PARTIAL")
        print(f"\n  {table:<30} [{status}]")
        print(f"    attempted={attempted:>4}  inserted={inserted:>4}  "
              f"rejected={rejected:>4}  duplicates={dup:>3}  fk_failures={fk:>3}")
        for e in r.get("errors", [])[:5]:
            print(f"    ! {e.get('type','?')}: key={e.get('row_key','?')} "
                  f"msg={e.get('message','')[:80]}")
        if len(r.get("errors", [])) > 5:
            print(f"    ... and {len(r['errors'])-5} more errors (see full report)")

    print("\n" + "-" * 70)
    print(f"  TOTAL: attempted={total_attempted}  inserted={total_inserted}  "
          f"rejected={total_rejected}  duplicates={total_dup}  fk_failures={total_fk}")
    print("=" * 70 + "\n")


def main():
    _load_env()

    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source-dir", required=True, type=Path,
                        help="Directory containing the CSV fixture files")
    parser.add_argument("--repairs", choices=["none", "known"], default="known",
                        help="Apply known CSV repairs (recommended: 'known')")
    parser.add_argument("--execute", action="store_true",
                        help="Actually write to the database. Without this flag, "
                             "runs in dry-run mode (validates only).")
    args = parser.parse_args()

    print(f"Source dir : {args.source_dir}")
    print(f"Repairs    : {args.repairs}")
    print(f"Mode       : {'EXECUTE (WILL WRITE TO DB)' if args.execute else 'DRY-RUN (no DB writes)'}")
    print()

    # Phase 1: Validate CSVs
    print("Validating CSV files...")
    data, val_report = validate(str(args.source_dir), args.repairs)

    print(f"\nValidation results:")
    for table in ORDER:
        valid = val_report["valid_counts"].get(table, 0)
        print(f"  {table:<30} valid_rows={valid}")
    print(f"\n  error_count  = {val_report['error_count']}")
    print(f"  repair_count = {val_report['repair_count']}")

    if val_report["error_count"] > 0:
        print("\nWARNING: Validation errors found. "
              "Only valid rows will be seeded (invalid rows quarantined).")
        for issue in val_report["issues"]:
            if issue["code"] == "ERROR":
                print(f"  [{issue['table']} line {issue['line']}] {issue['message']}")

    if not args.execute:
        print("\nDRY-RUN complete. No database writes performed.")
        print("Re-run with --execute to seed the database.")
        # Still show what would be seeded
        dry_report = {t: {"attempted": len(data.get(t, [])), "dry_run": True}
                      for t in SEED_ORDER}
        print_report(dry_report)
        return 0

    # Phase 2: Connect and seed
    print("\nConnecting to Supabase...")
    conn, driver = _get_connection()

    try:
        with conn:  # transaction context: commits on exit, rolls back on exception
            # Check database state first
            cur = conn.cursor()
            cur.execute(
                "SELECT COUNT(*) FROM information_schema.schemata "
                "WHERE schema_name = 'corporate_actions'"
            )
            schema_exists = cur.fetchone()[0] > 0
            if not schema_exists:
                print("ERROR: Schema 'corporate_actions' does not exist. "
                      "Run V01-V05 SQL files first.")
                conn.rollback()
                sys.exit(1)

            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.portfolios"
            )
            existing = cur.fetchone()[0]
            if existing > 0:
                print(f"ERROR: Database already contains {existing} portfolio row(s). "
                      "Seeding into a non-empty database is not allowed. "
                      "Reset first if you want to re-seed.")
                conn.rollback()
                sys.exit(1)
            cur.close()

            print("Database is clean. Starting seed...")
            report = seed(data, conn, driver, dry_run=False)

    except Exception as e:
        print(f"\nERROR during seeding: {type(e).__name__}: {e}")
        print("Transaction rolled back. No data was committed.")
        sys.exit(1)
    finally:
        try:
            conn.close()
        except Exception:
            pass

    print_report(report)
    total_errors = sum(r.get("rejected", 0) for r in report.values())
    if total_errors:
        print(f"WARNING: {total_errors} row(s) were rejected. "
              "Check errors above before proceeding.")
        return 1
    print("Seed completed successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
