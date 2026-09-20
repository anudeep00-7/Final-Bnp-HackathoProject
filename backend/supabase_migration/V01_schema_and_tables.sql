-- =============================================================================
-- V01_schema_and_tables.sql
-- ActiLedger → Supabase Migration
-- Phase: Schema creation + all 12 tables
--
-- CHANGES FROM ORIGINAL DDL (01_create_schema.sql + 02_create_tables.sql):
--   1. Removed PostgreSQL version assertion (PG17-only check). Supabase
--      runs PostgreSQL 15/16/17 depending on instance tier.
--   2. Removed database-name assertion ('corporate_actions_db'). Supabase
--      uses 'postgres' as the default database name.
--   3. Schema is kept as 'corporate_actions' (not collapsed to 'public') so
--      PostgREST can expose it via a dedicated API schema config if needed.
--      Alternatively, you may rename to 'public' — see NOTE below.
--   4. auth_subject column on users typed as TEXT (unchanged) — will be
--      linked to auth.users(id)::text by application code, not DB FK,
--      because auth.users lives in a separate Supabase-managed schema.
--   5. REVOKE on PUBLIC preserved; Supabase grants anon/authenticated roles
--      separately (see V04_rls.sql).
--   6. 'finite_numeric' domain preserved — Supabase supports custom domains.
--   7. 'GENERATED ALWAYS AS IDENTITY' is fully supported in Supabase PG.
--   8. All other table definitions are byte-for-byte from 02_create_tables.sql.
--
-- NOTE ON SCHEMA: If you want PostgREST to auto-expose these tables without
-- extra config, rename schema to 'public'. To use 'corporate_actions' schema,
-- add it to the "Extra search path" in Supabase Dashboard → API settings.
-- =============================================================================

-- ── Safety guard: refuse to run if schema already exists ─────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata
             WHERE schema_name = 'corporate_actions') THEN
    RAISE EXCEPTION 'Schema corporate_actions already exists. Run V00_reset.sql first if you want to recreate it.';
  END IF;
END $$;

-- ── Schema ────────────────────────────────────────────────────────────────────
CREATE SCHEMA corporate_actions;
REVOKE ALL ON SCHEMA corporate_actions FROM PUBLIC;

-- ── Financial precision domain ────────────────────────────────────────────────
-- Rejects NaN / Infinity at DB level — critical for financial calculations.
CREATE DOMAIN corporate_actions.finite_numeric AS numeric
  CHECK (VALUE NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric));

-- ── Set search path for remainder of this script ──────────────────────────────
SET search_path = corporate_actions, pg_catalog;

-- ── 1. securities ─────────────────────────────────────────────────────────────
-- Static reference data: 14 rows from D1 securities.csv
-- Supports self-FK for underlying instruments (e.g. convertible bonds → equity)
CREATE TABLE securities (
  security_id              text PRIMARY KEY,
  symbol                   text NOT NULL,
  name                     text NOT NULL,
  type                     text NOT NULL,    -- EQUITY | CONVERTIBLE_BOND | PREFERENCE_SHARE
  currency                 text NOT NULL,    -- ISO 4217 e.g. 'USD'
  underlying_security_id   text,             -- self-FK added in V02_constraints.sql
  status                   text NOT NULL     -- ACTIVE | INACTIVE | DELISTED
);

-- ── 2. portfolios ─────────────────────────────────────────────────────────────
-- Client account master: 8 rows from D2 portfolios.csv
CREATE TABLE portfolios (
  portfolio_id    text PRIMARY KEY,
  portfolio_name  text NOT NULL,
  client_id       text NOT NULL,
  client_type     text NOT NULL,   -- INDIVIDUAL | PENSION | FAMILY_OFFICE | MUTUAL_FUND | ENDOWMENT | PROP_DESK
  base_currency   text NOT NULL    -- ISO 4217
);

-- ── 3. users ──────────────────────────────────────────────────────────────────
-- Application identity table.
-- auth_subject = Supabase auth.users(id)::text — set this when creating users
-- via Supabase Auth. Intentionally NOT a DB-level FK (auth schema is managed
-- by Supabase and is not directly referenceable by the application schema).
CREATE TABLE users (
  user_id       text PRIMARY KEY,
  display_name  text NOT NULL,
  role          text NOT NULL,     -- ADMIN | ANALYST
  auth_subject  text UNIQUE,       -- links to auth.users(id) — set by backend on registration
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- ── 4. user_portfolios ────────────────────────────────────────────────────────
-- Junction: which portfolios an Analyst can see.
-- ADMIN role on users table bypasses this; RLS checks role first.
CREATE TABLE user_portfolios (
  user_id       text NOT NULL REFERENCES users,
  portfolio_id  text NOT NULL REFERENCES portfolios,
  PRIMARY KEY (user_id, portfolio_id)
);

-- ── 5. positions ──────────────────────────────────────────────────────────────
-- Time-series ledger of quantity & cost basis per portfolio/security/date.
-- Bootstrap rows come from D3 positions.csv (as_of_date = 2026-01-01).
-- Post-processing rows are appended (never updated) by the backend engine.
-- Views current_positions selects DISTINCT ON (portfolio_id, security_id)
-- with ORDER BY as_of_date DESC to get the latest row.
CREATE TABLE positions (
  portfolio_id  text NOT NULL REFERENCES portfolios,
  security_id   text NOT NULL REFERENCES securities,
  qty           finite_numeric NOT NULL,
  avg_cost      finite_numeric NOT NULL,
  as_of_date    date NOT NULL,
  PRIMARY KEY (portfolio_id, security_id, as_of_date)
);

-- ── 6. cash_balances ─────────────────────────────────────────────────────────
-- Time-series cash ledger per portfolio/currency/date.
-- Bootstrap rows from D4 cash_balances.csv (as_of_date = 2026-01-01).
CREATE TABLE cash_balances (
  portfolio_id  text NOT NULL REFERENCES portfolios,
  currency      text NOT NULL,
  balance       finite_numeric NOT NULL,
  as_of_date    date NOT NULL,
  PRIMARY KEY (portfolio_id, currency, as_of_date)
);

-- ── 7. prices ─────────────────────────────────────────────────────────────────
-- Historical closing prices: 41 rows from D5 prices.csv.
-- Used for before/after market-value calculation in processing.
CREATE TABLE prices (
  security_id   text NOT NULL REFERENCES securities,
  price_date    date NOT NULL,
  close_price   finite_numeric NOT NULL,
  note          text,
  PRIMARY KEY (security_id, price_date)
);

-- ── 8. corporate_action_events ────────────────────────────────────────────────
-- Source-of-truth for event mechanical terms: 16 rows from D6 corporate_actions.csv.
-- Note: 'status' here = source status from CSV (ACTIVE/REVERSED/REJECTED/etc.),
-- NOT the processing status (which lives in ca_processing).
-- CA016 arrives as REVERSED from source; it must NOT be processed.
CREATE TABLE corporate_action_events (
  ca_id                    text PRIMARY KEY,
  security_id              text NOT NULL REFERENCES securities,
  action_type              text NOT NULL,   -- see CHECK in V02_constraints.sql
  tier                     smallint NOT NULL,
  status                   text NOT NULL,   -- ACTIVE | REVERSED | REJECTED | INCOMPLETE | CANCELLED
  ex_date                  date NOT NULL,
  record_date              date,
  pay_date                 date,
  election_deadline        date,
  ratio_numerator          finite_numeric,
  ratio_denominator        finite_numeric,
  cash_rate_per_share      finite_numeric,
  subscription_price       finite_numeric,
  offer_price              finite_numeric,
  new_security_id          text REFERENCES securities,
  cost_basis_allocation_pct  finite_numeric,
  tax_withholding_pct      finite_numeric,
  notes                    text,
  UNIQUE (ca_id, security_id)   -- compound ref used by ca_processing FK
);

-- ── 9. event_terms ────────────────────────────────────────────────────────────
-- Application-managed metadata: rounding policy, analyst overrides, processing gate.
-- All 16 ACTIVE events must have a row here; processing is blocked until
-- processing_block_reason is cleared (empty string) by an authorized reviewer.
-- Populated by import_data.py automatically for all imported events.
CREATE TABLE event_terms (
  ca_id                     text PRIMARY KEY REFERENCES corporate_action_events,
  announcement_date         date,
  parent_ca_id              text REFERENCES corporate_action_events,    -- CA010 → CA001
  supersedes_ca_id          text REFERENCES corporate_action_events,    -- for corrections
  new_name                  text,    -- e.g. 'Harbor Retail Group' for CA014
  new_symbol                text,    -- e.g. 'HRG' for CA014
  reinvestment_price        finite_numeric,   -- e.g. 42.00 for CA010 DRIP
  tender_cap_pct            finite_numeric,   -- e.g. 30 for CA009
  policy                    jsonb NOT NULL DEFAULT '{}'::jsonb,   -- rounding + eligibility policy
  processing_block_reason   text NOT NULL DEFAULT
    'Eligibility, recognition and rounding policy require review',
  reviewed_by               text REFERENCES users,
  reviewed_at               timestamptz,
  provenance                text NOT NULL    -- source of terms (e.g. 'D6 notes')
);

-- ── 10. ca_elections ─────────────────────────────────────────────────────────
-- Voluntary elections confirmed by portfolios: 9 rows from D7 ca_elections.csv.
-- UNIQUE(ca_id, portfolio_id) enforces one election per portfolio per event.
CREATE TABLE ca_elections (
  election_id    text PRIMARY KEY,
  ca_id          text NOT NULL REFERENCES corporate_action_events,
  portfolio_id   text NOT NULL REFERENCES portfolios,
  election_type  text NOT NULL,   -- SUBSCRIBE | LAPSE | SELL | TENDER | DRIP | CASH | CONVERT
  elected_qty    finite_numeric,
  election_date  date NOT NULL,
  status         text NOT NULL,   -- CONFIRMED only
  notes          text,
  UNIQUE (ca_id, portfolio_id),
  UNIQUE (election_id, ca_id, portfolio_id)   -- compound ref used by ca_processing FK
);

-- ── 11. ca_processing ────────────────────────────────────────────────────────
-- Immutable ledger of financial adjustments (one row per portfolio per event).
-- PENDING → PROCESSED | FAILED | REJECTED. PROCESSED → REVERSED (via reversal).
-- Never delete rows; use reversal_of self-FK for corrections.
CREATE TABLE ca_processing (
  processing_id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ca_id                    text NOT NULL,
  portfolio_id             text NOT NULL REFERENCES portfolios,
  security_id              text NOT NULL REFERENCES securities,
  election_id              text,
  status                   text NOT NULL DEFAULT 'PENDING',
  processing_date          timestamptz NOT NULL DEFAULT clock_timestamp(),
  effective_date           date NOT NULL,
  rule_applied             text NOT NULL,
  rule_version             text NOT NULL,
  eligible_qty             finite_numeric,
  eligibility_date         date,
  before_quantity          finite_numeric,
  after_quantity           finite_numeric,
  before_avg_cost          finite_numeric,
  after_avg_cost           finite_numeric,
  before_cost_basis        finite_numeric,
  after_cost_basis         finite_numeric,
  currency                 text NOT NULL,
  before_cash              finite_numeric,
  cash_movement            finite_numeric NOT NULL DEFAULT 0,
  after_cash               finite_numeric,
  before_market_value      finite_numeric,
  after_market_value       finite_numeric,
  before_receivable_value  finite_numeric,
  after_receivable_value   finite_numeric,
  reconciliation_difference  finite_numeric,
  expected_leakage         finite_numeric,
  before_state             jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state              jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_reason             text,
  processed_by             text NOT NULL REFERENCES users,
  reversal_of              bigint UNIQUE REFERENCES ca_processing,
  reversal_reason          text,
  created_at               timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (ca_id, security_id) REFERENCES corporate_action_events (ca_id, security_id),
  FOREIGN KEY (election_id, ca_id, portfolio_id)
    REFERENCES ca_elections (election_id, ca_id, portfolio_id),
  UNIQUE (processing_id, ca_id, portfolio_id, security_id),
  UNIQUE (processing_id, portfolio_id)
);

-- ── 12. settlements ──────────────────────────────────────────────────────────
-- Cash and security settlement legs produced during processing.
-- Each action leg (gross dividend, withholding, new shares, etc.) is a row.
-- Immutable once SETTLED; CANCELLED is allowed. Never delete.
CREATE TABLE settlements (
  settlement_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  processing_id        bigint NOT NULL,
  portfolio_id         text NOT NULL REFERENCES portfolios,
  security_id          text REFERENCES securities,
  leg_code             text NOT NULL,         -- e.g. 'GROSS_DIV', 'WITHHOLDING', 'NEW_SHARES'
  settlement_type      text NOT NULL,         -- CASH | SECURITY
  quantity_movement    finite_numeric NOT NULL DEFAULT 0,
  cash_movement        finite_numeric NOT NULL DEFAULT 0,
  currency             text NOT NULL,
  recognition_date     date NOT NULL,
  settlement_date      date NOT NULL,
  settled_at           timestamptz,
  status               text NOT NULL DEFAULT 'PENDING',  -- PENDING | SETTLED | CANCELLED
  cost_basis_movement  finite_numeric,
  reversal_of          bigint UNIQUE REFERENCES settlements,
  FOREIGN KEY (processing_id, portfolio_id)
    REFERENCES ca_processing (processing_id, portfolio_id),
  UNIQUE (processing_id, leg_code)
);

-- ── 13. audit_logs ───────────────────────────────────────────────────────────
-- Append-only history. Auto-populated by triggers in V03_triggers.sql.
-- IMMUTABLE: UPDATE/DELETE/TRUNCATE blocked by prevent_mutation trigger.
CREATE TABLE audit_logs (
  audit_id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  processing_id    bigint NOT NULL,
  ca_id            text NOT NULL REFERENCES corporate_action_events,
  security_id      text NOT NULL REFERENCES securities,
  portfolio_id     text NOT NULL REFERENCES portfolios,
  action           text NOT NULL,    -- e.g. 'PROCESSING_INSERT', 'REVERSAL', 'SETTLEMENT_INSERT'
  outcome          text NOT NULL,    -- mirrors ca_processing.status at time of write
  processing_date  timestamptz NOT NULL,
  rule_applied     text NOT NULL,
  before_state     jsonb NOT NULL,
  after_state      jsonb NOT NULL,
  cash_movement    finite_numeric NOT NULL,
  performed_by     text NOT NULL REFERENCES users,
  occurred_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  reason           text,
  reversal_of      bigint REFERENCES audit_logs,
  FOREIGN KEY (processing_id, ca_id, portfolio_id, security_id)
    REFERENCES ca_processing (processing_id, ca_id, portfolio_id, security_id)
);
