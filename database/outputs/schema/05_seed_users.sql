-- OPTIONAL demonstration role-selection identities; no login credentials or real user assignments.
SET search_path=corporate_actions,pg_catalog;
INSERT INTO users(user_id,display_name,role) VALUES
 ('DEMO_ADMIN','Demo Administrator','ADMIN'),('DEMO_ANALYST','Demo Analyst','ANALYST')
ON CONFLICT(user_id) DO NOTHING;
-- Assign explicitly after import, e.g. INSERT INTO corporate_actions.user_portfolios VALUES ('DEMO_ANALYST','P001');
