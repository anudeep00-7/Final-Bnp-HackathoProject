# Corporate Actions Processing and Portfolio Impact Hub — database

PostgreSQL **17**, database **corporate_actions_db**, schema **corporate_actions**.
SQL is compatible with pgAdmin; the reset/grant scripts use explicitly labeled psql commands.
Python 3.10+ and pinned `psycopg[binary]==3.2.10` implement validation/import. Financial values use
finite `NUMERIC` and Python `Decimal`, never float.

## Delivery status

All nine supplied files were inspected. All **123** CSV records validate with **three explicitly reported
repairs**; original files remain unchanged. **31 Python tests passed**. Schema and test SQL, including PL/pgSQL
function bodies, parsed successfully using PostgreSQL 17's parser (pglast).

**Live database installation/import and SQL tests could not run in the authoring sandbox.** PostgreSQL 17.11
is installed, but `initdb` fails at `shmget` with `Operation not permitted`. The import connection attempt failed;
no database records were loaded. SQL syntax checks are not a substitute for database execution. Use the steps
below on your Mac to complete runtime verification. Do not call this production-certified or a complete processing engine.

## 1. Start PostgreSQL and create the database

Run from this `database/` directory. If PostgreSQL 17 is not installed, install it using your normal package manager.
For an existing Homebrew PostgreSQL 17 installation:

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
brew services start postgresql@17
createdb corporate_actions_db
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
export DATABASE_URL='postgresql:///corporate_actions_db'
```

If the database already exists, skip `createdb`. `DATABASE_URL` may use your configured host/port/user;
keep passwords in environment variables or `.pgpass`, not committed files. `.env.example` documents the variable;
scripts do not automatically load `.env`. Intel Homebrew typically uses `/usr/local` instead of `/opt/homebrew`.

In pgAdmin, connect to the `postgres` maintenance database, execute `CREATE DATABASE corporate_actions_db;`
outside a transaction, then reconnect to the new database.

## 2. Install the schema

```bash
python scripts/migrate.py
```

This runs schema files atomically in numbered order, excluding optional demo users, and refuses an existing schema.
For pgAdmin, execute files 01, 02, 03, 04, 06, 07 in one transaction in the new database. No extension is required.
Never apply these initial-create scripts as an in-place upgrade to an existing schema; write a migration instead.

## 3. Validate and import

Use the original supplied directory (files remain read only), or the byte-for-byte copies in `tests/fixtures`:

```bash
export SOURCE_DIR='/Users/likki/Downloads/UC 4 data32a2081'
python scripts/validate_csvs.py --source-dir "$SOURCE_DIR" --report data/validation_strict.json
```

Strict validation exits **1**, intentionally: three malformed rows and three dependent election references fail.
The explicit known repair mode joins final note fields on D5 line 19 and D6 line 15 and removes one surplus empty
field on D6 line 11. Whitelisting checks the source file hash and exact row signature; changed files are not guessed.

```bash
python scripts/validate_csvs.py --source-dir "$SOURCE_DIR" --repairs known --report data/validation_repaired.json
python scripts/import_data.py --source-dir "$SOURCE_DIR" --repairs known --report data/import_report.json
```

Expected counts: securities 14, portfolios 8, positions 27, cash_balances 8, prices 41, corporate_action_events 16,
ca_elections 9. Supplemental `event_terms` adds 16 application records. Import is atomic across all tables.
Repeated import rejects duplicates and rolls back; it never silently overwrites data. An optional `--allow-partial`
imports only validated records and explicitly reports all quarantined rows; default is all-or-nothing.
Missing/invalid parents propagate to dependent rows. Strict parsing errors stop the rest of the affected file.

All ACTIVE events have a processing gate until eligibility, recognition and rounding policies are reviewed.
CA005 has conflicting merger cash terms. Do not clear gates just to make a demonstration process arbitrary values.
See [business rules](docs/BUSINESS_RULES.md) for the full list of unresolved terms and source-price inconsistencies.

## 4. Users and access

No users dataset was provided. For optional local role-selection demonstrations:

```bash
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" -f schema/05_seed_users.sql
```

This creates `DEMO_ADMIN` and `DEMO_ANALYST` without credentials and makes no invented portfolio assignments.
Bind real users using external authentication subjects; no password table or plaintext password is needed.
Assign an Analyst explicitly through `user_portfolios`. Follow [backend integration](docs/BACKEND_CONTRACT.md)
for trusted-service authorization, minimal grants and the limits of the supplied query helper (not RLS).

## 5. Run tests

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
python tests/run_database_tests.py
```

The Python suite uses original fixture copies and temporary directories. It covers strict/repair parsing, hashes,
duplicates, headers, required fields, non-finite values, dates, foreign keys, elections, five required core actions,
rights full/partial/lapse, insufficient cash, entitlement overflow, reversed events and fractional policy failures.
The SQL suite expects imported fixture data and no processed production events. It checks primary/foreign keys,
status/transition guards, context consistency, duplicate processing, audit immutability, settlements and reversal
structure, and rolls back test writes. SQL tests must be run in a development database only.

`core_rules.py` is a pure reference preview calculator, not a book-posting engine. Tests use a documented demo
rounding policy, never an assertion that the workbook prescribed rounding. Remaining action types are stored
but require dedicated reviewed backend calculators. Reversal structure is provided for future service work;
a complete book reversal procedure is intentionally not exposed.

## 6. Development reset — destructive

The following deletes **everything in corporate_actions** and recreates it atomically. It requires both the
expected database name and the exact explicit confirmation value. It never drops the database or other schemas.

```bash
psql -X -v ON_ERROR_STOP=1 -v confirm_reset=corporate_actions_db "$DATABASE_URL" -f scripts/reset_database.sql
python scripts/import_data.py --source-dir "$SOURCE_DIR" --repairs known --report data/import_report.json
```

Re-seed demo users explicitly if needed. No reset runs automatically during import or testing.

## Files and architecture

- [ER diagram](docs/ER_DIAGRAM.md): all 13 tables, column keys and actual SQL foreign-key edges.
- [Data dictionary](docs/DATA_DICTIONARY.md): every column, type, nullability, keys and source/application origin.
- [Design](docs/DATABASE_DESIGN.md): model, lifecycle, transaction/reversal and access decisions.
- [Source inspection](docs/SOURCE_INSPECTION.md): exact CSV headers and row findings.
- [Business rules](docs/BUSINESS_RULES.md): workbook row references, defects and unresolved policies.
- [Backend contract](docs/BACKEND_CONTRACT.md): posting, eligibility, historical state, reconciliation and reversal.
- [Indexes](docs/INDEXES.md): purpose of each explicit index and existing key coverage.
- `data/`: validation, source inventory and verification reports only; no transactional source tables.
- `tests/fixtures/`: untouched CSV copies for reproducible tests and optional local demonstration import.

No frontend/application files were modified. No transactional raw-notices table is created. No separate reversal
table is required: processing and settlement self-links plus audit history retain the original and inverse records.
