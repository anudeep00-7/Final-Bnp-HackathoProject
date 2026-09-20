-- =============================================================================
-- V06_seed.sql
-- ActiLedger → Supabase Migration
-- Phase: Static reference seed data only
--
-- CONTENTS: Demo users only (no real users were supplied in the dataset).
-- All transactional seed data (securities, portfolios, positions, cash balances,
-- prices, corporate_action_events, event_terms, ca_elections) is loaded by the
-- Python seed script (seed_supabase.py), NOT this SQL file.
--
-- IMPORTANT: Run this AFTER V01–V05 and AFTER Python seed has completed.
-- ON CONFLICT DO NOTHING makes this safe to re-run.
-- =============================================================================

SET search_path = corporate_actions, pg_catalog;

-- Demo users (no real password, no Supabase Auth account linked yet)
-- auth_subject will be populated by the backend when these users log in
-- via Supabase Auth for the first time.
INSERT INTO users (user_id, display_name, role, auth_subject, is_active)
VALUES
  ('DEMO_ADMIN',   'Demo Administrator', 'ADMIN',   NULL, true),
  ('DEMO_ANALYST', 'Demo Analyst',       'ANALYST', NULL, true)
ON CONFLICT (user_id) DO NOTHING;

-- Note: user_portfolios assignments for DEMO_ANALYST must be made explicitly
-- after portfolios are seeded. Example (run after Python seed):
-- INSERT INTO corporate_actions.user_portfolios VALUES ('DEMO_ANALYST', 'P001');
-- INSERT INTO corporate_actions.user_portfolios VALUES ('DEMO_ANALYST', 'P002');
-- Add whichever portfolios are appropriate for the demo scenario.
