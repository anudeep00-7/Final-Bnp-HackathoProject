-- Execute inside corporate_actions_db. Database creation is separate (cannot run in a transaction).
DO $$ BEGIN
 IF current_database() <> 'corporate_actions_db' THEN RAISE EXCEPTION 'Connect to corporate_actions_db'; END IF;
 IF current_setting('server_version_num')::int < 170000 OR current_setting('server_version_num')::int >= 180000 THEN
 RAISE EXCEPTION 'PostgreSQL 17 required'; END IF;
END $$;
CREATE SCHEMA corporate_actions;
REVOKE ALL ON SCHEMA corporate_actions FROM PUBLIC;
CREATE DOMAIN corporate_actions.finite_numeric AS numeric
 CHECK (VALUE NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric));
