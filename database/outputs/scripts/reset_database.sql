-- DESTRUCTIVE development-only reset. Guarded for psql; never run on production.
-- psql -X -v ON_ERROR_STOP=1 -v confirm_reset=corporate_actions_db -f scripts/reset_database.sql "$DATABASE_URL"
\if :{?confirm_reset}
 SELECT :'confirm_reset'='corporate_actions_db' AND current_database()='corporate_actions_db' AS reset_allowed \gset
 \if :reset_allowed
  BEGIN;
  DROP SCHEMA IF EXISTS corporate_actions CASCADE;
  \ir ../schema/01_create_schema.sql
  \ir ../schema/02_create_tables.sql
  \ir ../schema/03_constraints.sql
  \ir ../schema/04_indexes.sql
  \ir ../schema/06_views.sql
  \ir ../schema/07_settlement_audit.sql
  COMMIT;
 \else
  \echo 'Refused: wrong database or confirmation value'
  \quit 1
 \endif
\else
 \echo 'Refused: supply -v confirm_reset=corporate_actions_db'
 \quit 1
\endif
-- Reload with import_data.py; seeding users remains explicit.
