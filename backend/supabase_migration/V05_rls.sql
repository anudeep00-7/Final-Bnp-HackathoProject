-- =============================================================================
-- V05_rls.sql
-- ActiLedger → Supabase Migration
-- Phase: Row Level Security (RLS) policies
--
-- DESIGN DECISIONS:
--
-- 1. BACKEND SERVICE ROLE (FastAPI):
--    The FastAPI backend connects using the Supabase SERVICE ROLE key
--    (found in Project Settings → API → service_role). This role BYPASSES
--    RLS entirely, giving the backend full write access. This is intentional:
--    the backend enforces authorization in Python before any DB write.
--    NEVER expose the service_role key to frontend clients.
--
-- 2. FRONTEND DIRECT ACCESS (optional / future):
--    If the frontend ever queries Supabase directly (e.g. via supabase-js),
--    it uses the ANON or AUTHENTICATED role, which IS subject to RLS.
--    The policies below enforce role-based access for these paths.
--
-- 3. AUTH SUBJECT LINKAGE:
--    The 'authenticated' role in Supabase sets auth.uid() to the user's
--    Supabase Auth UUID. The users table has an auth_subject column.
--    Policies use: EXISTS (SELECT 1 FROM corporate_actions.users WHERE
--    auth_subject = auth.uid()::text AND ...) to identify the caller.
--
-- 4. ADMIN vs ANALYST:
--    ADMIN: can see ALL portfolios. Identified by role = 'ADMIN'.
--    ANALYST: can only see portfolios in their user_portfolios assignments.
--
-- 5. AUDIT IMMUTABILITY:
--    audit_logs: SELECT allowed (Admins all; Analysts their portfolios).
--    INSERT/UPDATE/DELETE: BLOCKED for all non-service-role callers (triggers handle inserts).
--
-- 6. TABLES WITHOUT PORTFOLIO FILTER:
--    securities, prices, corporate_action_events, event_terms:
--    All authenticated users can SELECT. No writes via frontend.
-- =============================================================================

SET search_path = corporate_actions, pg_catalog;

-- ─────────────────────────────────────────────────────────────────────────────
-- ENABLE RLS on all tables
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE securities              ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_portfolios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_balances           ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_action_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_terms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca_elections            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca_processing           ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs              ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: identify the current Supabase-authenticated user's internal record
-- ─────────────────────────────────────────────────────────────────────────────
-- Used in multiple policies below to avoid repetition.
-- Returns the users row for the currently authenticated Supabase session.
-- Returns no rows if the session has no matching user (access denied).

-- ─────────────────────────────────────────────────────────────────────────────
-- REFERENCE DATA: securities, prices, corporate_action_events, event_terms
-- All authenticated users can SELECT. No direct INSERT/UPDATE/DELETE.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can view securities"
  ON securities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view prices"
  ON prices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view corporate action events"
  ON corporate_action_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view event terms"
  ON event_terms FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- users table
-- Users can read their own record. Admins can read all.
-- No direct INSERT/UPDATE from frontend (managed by backend/admin).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Users can view their own record"
  ON users FOR SELECT
  TO authenticated
  USING (
    auth_subject = auth.uid()::text
  );

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_subject = auth.uid()::text
        AND u.role = 'ADMIN'
        AND u.is_active
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- portfolios table
-- Admins see all. Analysts see only their assigned portfolios.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Admins can view all portfolios"
  ON portfolios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_subject = auth.uid()::text
        AND u.role = 'ADMIN'
        AND u.is_active
    )
  );

CREATE POLICY "Analysts can view assigned portfolios"
  ON portfolios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_portfolios up ON up.user_id = u.user_id
      WHERE u.auth_subject = auth.uid()::text
        AND u.is_active
        AND up.portfolio_id = portfolios.portfolio_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- user_portfolios
-- Admins can view all assignments. Analysts see their own.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Admins can view all user_portfolios"
  ON user_portfolios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_subject = auth.uid()::text
        AND u.role = 'ADMIN'
        AND u.is_active
    )
  );

CREATE POLICY "Analysts can view their own assignments"
  ON user_portfolios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_subject = auth.uid()::text
        AND u.user_id = user_portfolios.user_id
        AND u.is_active
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- positions
-- Admins see all. Analysts see only their assigned portfolios.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Admins can view all positions"
  ON positions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_subject = auth.uid()::text
        AND u.role = 'ADMIN'
        AND u.is_active
    )
  );

CREATE POLICY "Analysts can view positions in assigned portfolios"
  ON positions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_portfolios up ON up.user_id = u.user_id
      WHERE u.auth_subject = auth.uid()::text
        AND u.is_active
        AND up.portfolio_id = positions.portfolio_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- cash_balances
-- Admins see all. Analysts see only their assigned portfolios.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Admins can view all cash balances"
  ON cash_balances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_subject = auth.uid()::text
        AND u.role = 'ADMIN'
        AND u.is_active
    )
  );

CREATE POLICY "Analysts can view cash balances in assigned portfolios"
  ON cash_balances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_portfolios up ON up.user_id = u.user_id
      WHERE u.auth_subject = auth.uid()::text
        AND u.is_active
        AND up.portfolio_id = cash_balances.portfolio_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- ca_elections
-- Admins see all. Analysts see elections for their assigned portfolios.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Admins can view all elections"
  ON ca_elections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_subject = auth.uid()::text
        AND u.role = 'ADMIN'
        AND u.is_active
    )
  );

CREATE POLICY "Analysts can view elections for assigned portfolios"
  ON ca_elections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_portfolios up ON up.user_id = u.user_id
      WHERE u.auth_subject = auth.uid()::text
        AND u.is_active
        AND up.portfolio_id = ca_elections.portfolio_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- ca_processing
-- Admins see all. Analysts see only their assigned portfolios.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Admins can view all processing records"
  ON ca_processing FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_subject = auth.uid()::text
        AND u.role = 'ADMIN'
        AND u.is_active
    )
  );

CREATE POLICY "Analysts can view processing for assigned portfolios"
  ON ca_processing FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_portfolios up ON up.user_id = u.user_id
      WHERE u.auth_subject = auth.uid()::text
        AND u.is_active
        AND up.portfolio_id = ca_processing.portfolio_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- settlements
-- Admins see all. Analysts see only their assigned portfolios.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Admins can view all settlements"
  ON settlements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_subject = auth.uid()::text
        AND u.role = 'ADMIN'
        AND u.is_active
    )
  );

CREATE POLICY "Analysts can view settlements for assigned portfolios"
  ON settlements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_portfolios up ON up.user_id = u.user_id
      WHERE u.auth_subject = auth.uid()::text
        AND u.is_active
        AND up.portfolio_id = settlements.portfolio_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_logs
-- Admins see all. Analysts see only records for their assigned portfolios.
-- INSERT is handled exclusively by SECURITY DEFINER triggers — no direct insert policy.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_subject = auth.uid()::text
        AND u.role = 'ADMIN'
        AND u.is_active
    )
  );

CREATE POLICY "Analysts can view audit logs for assigned portfolios"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_portfolios up ON up.user_id = u.user_id
      WHERE u.auth_subject = auth.uid()::text
        AND u.is_active
        AND up.portfolio_id = audit_logs.portfolio_id
    )
  );
