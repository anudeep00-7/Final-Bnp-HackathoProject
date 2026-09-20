-- =============================================================================
-- V04_indexes_and_views.sql
-- ActiLedger → Supabase Migration
-- Phase: Indexes, Views, and can_view_portfolio helper function
--
-- CHANGES FROM ORIGINAL 04_indexes.sql + 06_views.sql:
--   1. All indexes are identical to the original — no changes needed.
--   2. Views are identical to the original.
--   3. can_view_portfolio() helper function preserved exactly.
--   4. REVOKE on tables/sequences is kept (Supabase starts with no grants).
--      RLS policies in V05_rls.sql add row-level security on top.
-- =============================================================================

SET search_path = corporate_actions, pg_catalog;

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- Partial unique index: one original (non-reversal) processing per event+portfolio
-- This enforces idempotency: re-processing the same action for the same portfolio
-- is rejected unless the prior processing has been reversed.
CREATE UNIQUE INDEX one_original_processing
  ON ca_processing (ca_id, portfolio_id)
  WHERE reversal_of IS NULL
    AND status IN ('PENDING','PROCESSED','REVERSED');

-- positions: cross-portfolio lookups by security on a given date
CREATE INDEX positions_security_date
  ON positions (security_id, as_of_date);

-- corporate_action_events: calendar queries (upcoming events by date)
CREATE INDEX events_calendar
  ON corporate_action_events (ex_date, status);

CREATE INDEX events_security
  ON corporate_action_events (security_id);

CREATE INDEX events_action_status
  ON corporate_action_events (action_type, status);

-- Partial indexes on nullable date columns (avoids indexing NULLs)
CREATE INDEX events_record_date
  ON corporate_action_events (record_date)
  WHERE record_date IS NOT NULL;

CREATE INDEX events_pay_date
  ON corporate_action_events (pay_date)
  WHERE pay_date IS NOT NULL;

CREATE INDEX events_election_deadline
  ON corporate_action_events (election_deadline)
  WHERE election_deadline IS NOT NULL;

-- ca_elections: portfolio-first lookup (Analyst views their elections)
CREATE INDEX elections_portfolio
  ON ca_elections (portfolio_id, ca_id);

-- ca_processing: portfolio timeline + status monitoring
CREATE INDEX processing_portfolio_date
  ON ca_processing (portfolio_id, processing_date);

CREATE INDEX processing_status
  ON ca_processing (status, processing_date);

-- settlements: settlement forecast by portfolio+date
CREATE INDEX idx_settlement_forecast
  ON settlements (portfolio_id, settlement_date, status);

CREATE INDEX settlement_security
  ON settlements (security_id)
  WHERE security_id IS NOT NULL;

-- audit_logs: portfolio history + event lookup
CREATE INDEX audit_portfolio_date
  ON audit_logs (portfolio_id, occurred_at);

CREATE INDEX audit_event
  ON audit_logs (ca_id);

CREATE INDEX audit_processing_id
  ON audit_logs (processing_id);

CREATE INDEX audit_security
  ON audit_logs (security_id, occurred_at);

-- user_portfolios: reverse lookup (which users have access to a portfolio)
CREATE INDEX assignments_portfolio
  ON user_portfolios (portfolio_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEWS
-- Note: These views are SECURITY INVOKER by default (standard PostgreSQL).
-- With RLS enabled on the base tables, RLS policies are enforced even through
-- these views when accessed via Supabase Auth'd requests.
-- ─────────────────────────────────────────────────────────────────────────────

-- Latest position per portfolio+security (time-series → point-in-time)
CREATE VIEW current_positions AS
  SELECT DISTINCT ON (portfolio_id, security_id) *
    FROM positions
    ORDER BY portfolio_id, security_id, as_of_date DESC;

-- Latest cash balance per portfolio+currency
CREATE VIEW current_cash_balances AS
  SELECT DISTINCT ON (portfolio_id, currency) *
    FROM cash_balances
    ORDER BY portfolio_id, currency, as_of_date DESC;

-- Pending settlement forecast (aggregated by portfolio/currency/date)
CREATE VIEW settlement_forecast AS
  SELECT
    portfolio_id, currency, settlement_date, settlement_type, security_id,
    sum(cash_movement)     AS cash_movement,
    sum(quantity_movement) AS quantity_movement
  FROM settlements
  WHERE status = 'PENDING'
  GROUP BY portfolio_id, currency, settlement_date, settlement_type, security_id;

-- Reconciliation: expected vs observed portfolio value change per processing
CREATE VIEW processing_reconciliation AS
  SELECT
    processing_id, ca_id, portfolio_id, status,
    before_market_value + before_cash + before_receivable_value AS before_total,
    after_market_value  + after_cash  + after_receivable_value  AS after_total,
    (after_market_value  + after_cash  + after_receivable_value)
    - (before_market_value + before_cash + before_receivable_value)  AS observed_difference,
    expected_leakage,
    reconciliation_difference
  FROM ca_processing;

-- ─────────────────────────────────────────────────────────────────────────────
-- AUTHORIZATION HELPER FUNCTION
-- Used by backend code to determine portfolio access before querying.
-- NOT a replacement for RLS — used alongside it.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION can_view_portfolio(p_user text, p_portfolio text)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = corporate_actions, pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.user_id = p_user
      AND u.is_active
      AND (
        u.role = 'ADMIN'
        OR EXISTS (
          SELECT 1 FROM user_portfolios a
          WHERE a.user_id = u.user_id
            AND a.portfolio_id = p_portfolio
        )
      )
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- DEFAULT REVOKE (defense-in-depth alongside RLS)
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON ALL TABLES    IN SCHEMA corporate_actions FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA corporate_actions FROM PUBLIC;
