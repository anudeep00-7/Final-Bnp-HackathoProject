-- =============================================================================
-- V03_triggers.sql
-- ActiLedger → Supabase Migration
-- Phase: PL/pgSQL functions + triggers
--
-- CHANGES FROM ORIGINAL 03_constraints.sql (trigger section) + 07_settlement_audit.sql:
--   1. SECURITY DEFINER functions: Supabase supports SECURITY DEFINER.
--      However, Supabase recommends setting search_path explicitly in the
--      function header to prevent search-path injection — already done here.
--   2. prevent_mutation, check_election, check_event_transition,
--      check_processing, audit_processing, check_settlement, audit_settlement
--      are all preserved exactly from the original DDL.
--   3. No behavioral changes. All trigger logic is faithful to the design.
--
-- SUPABASE NOTE: PL/pgSQL triggers run server-side and are fully supported.
-- SECURITY DEFINER + SET search_path is the correct pattern.
-- =============================================================================

SET search_path = corporate_actions, pg_catalog;

-- ─────────────────────────────────────────────────────────────────────────────
-- IMMUTABILITY: prevent UPDATE / DELETE / TRUNCATE on financial history tables
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION prevent_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% history is immutable', TG_TABLE_NAME
    USING ERRCODE = '23514';
END $$;

-- audit_logs: no modifications ever
CREATE TRIGGER audit_immutable
  BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_mutation();

-- ca_processing: no deletes; updates limited to PENDING→terminal by check_processing
CREATE TRIGGER processing_no_delete
  BEFORE DELETE OR TRUNCATE ON ca_processing
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_mutation();

-- settlements: no deletes; updates limited to PENDING→SETTLED/CANCELLED
CREATE TRIGGER settlement_no_delete
  BEFORE DELETE OR TRUNCATE ON settlements
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_mutation();

-- ─────────────────────────────────────────────────────────────────────────────
-- ELECTION VALIDATION: deadline, status, election-type compatibility
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION check_election()
RETURNS trigger LANGUAGE plpgsql
SET search_path = corporate_actions, pg_catalog AS $$
DECLARE
  e corporate_action_events;
BEGIN
  SELECT * INTO e
    FROM corporate_action_events WHERE ca_id = NEW.ca_id FOR SHARE;

  IF NOT FOUND THEN RETURN NEW; END IF;  -- FK error gives precise message

  IF e.status <> 'ACTIVE'
     OR NEW.election_date > e.election_deadline
     OR e.election_deadline IS NULL THEN
    RAISE EXCEPTION 'Event inactive or election after deadline'
      USING ERRCODE = '23514';
  END IF;

  IF NOT (
    (e.action_type = 'RIGHTS_ISSUE'   AND NEW.election_type IN ('SUBSCRIBE','SELL','LAPSE'))
    OR (e.action_type = 'TENDER_OFFER'  AND NEW.election_type = 'TENDER')
    OR (e.action_type = 'DRIP_ELECTION' AND NEW.election_type IN ('CASH','DRIP'))
    OR (e.action_type = 'CONVERSION'    AND NEW.election_type = 'CONVERT')
  ) THEN
    RAISE EXCEPTION 'Election incompatible with action type'
      USING ERRCODE = '23514';
  END IF;

  -- Prevent election change after processing has started
  IF EXISTS (
    SELECT 1 FROM ca_processing
    WHERE ca_id = NEW.ca_id
      AND portfolio_id = NEW.portfolio_id
      AND status IN ('PENDING','PROCESSED','REVERSED')
  ) THEN
    RAISE EXCEPTION 'Election locked by processing'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER election_guard
  BEFORE INSERT OR UPDATE ON ca_elections
  FOR EACH ROW EXECUTE FUNCTION check_election();

-- ─────────────────────────────────────────────────────────────────────────────
-- EVENT STATUS TRANSITION: only valid moves allowed; no edit while processing
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION check_event_transition()
RETURNS trigger LANGUAGE plpgsql
SET search_path = corporate_actions, pg_catalog AS $$
BEGIN
  IF OLD.status <> NEW.status AND NOT (
    (OLD.status = 'ACTIVE'
     AND NEW.status IN ('REJECTED','INCOMPLETE','CANCELLED','REVERSED'))
    OR (OLD.status = 'INCOMPLETE'
     AND NEW.status IN ('ACTIVE','REJECTED','CANCELLED'))
  ) THEN
    RAISE EXCEPTION 'Invalid event status transition'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM ca_processing
    WHERE ca_id = OLD.ca_id
      AND status IN ('PENDING','PROCESSED')
  ) THEN
    RAISE EXCEPTION 'Cannot edit event while pending or unreversed processing exists'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER event_guard
  BEFORE UPDATE ON corporate_action_events
  FOR EACH ROW EXECUTE FUNCTION check_event_transition();

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCESSING VALIDATION: idempotency, reversal integrity, processing gate
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION check_processing()
RETURNS trigger LANGUAGE plpgsql
SET search_path = corporate_actions, pg_catalog AS $$
DECLARE
  e    corporate_action_events;
  orig ca_processing;
  block text;
BEGIN
  SELECT * INTO e
    FROM corporate_action_events WHERE ca_id = NEW.ca_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  PERFORM 1 FROM portfolios WHERE portfolio_id = NEW.portfolio_id FOR UPDATE;

  IF TG_OP = 'UPDATE' THEN
    -- Only PENDING rows may be updated; PROCESSED → REVERSED is the one allowed UPDATE
    IF OLD.status <> 'PENDING'
       AND NOT (
         OLD.status = 'PROCESSED'
         AND NEW.status = 'REVERSED'
         AND OLD.reversal_of IS NULL
         AND (to_jsonb(OLD) - 'status') = (to_jsonb(NEW) - 'status')
       ) THEN
      RAISE EXCEPTION 'Completed processing is immutable'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.status = 'PENDING' AND (
      NEW.status NOT IN ('PROCESSED','FAILED','REJECTED')
      OR (OLD.ca_id, OLD.portfolio_id, OLD.security_id,
          OLD.election_id, OLD.reversal_of)
         IS DISTINCT FROM
         (NEW.ca_id, NEW.portfolio_id, NEW.security_id,
          NEW.election_id, NEW.reversal_of)
    ) THEN
      RAISE EXCEPTION 'Invalid processing transition/context'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Reversal must have a linked row
  IF NEW.status = 'REVERSED'
     AND NOT EXISTS (SELECT 1 FROM ca_processing WHERE reversal_of = NEW.processing_id)
  THEN
    RAISE EXCEPTION 'Linked reversal required'
      USING ERRCODE = '23514';
  END IF;

  -- Non-reversal processing: event must be ACTIVE and gate cleared
  IF NEW.reversal_of IS NULL AND NEW.status IN ('PENDING','PROCESSED') THEN
    IF e.status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Event is not ACTIVE' USING ERRCODE = '23514';
    END IF;
    SELECT processing_block_reason INTO block
      FROM event_terms WHERE ca_id = NEW.ca_id;
    IF block IS DISTINCT FROM '' THEN
      RAISE EXCEPTION 'Unreviewed event terms: %', coalesce(block, 'missing terms')
        USING ERRCODE = '23514';
    END IF;
    -- Election required for voluntary actions
    IF e.action_type IN ('RIGHTS_ISSUE','TENDER_OFFER','DRIP_ELECTION','CONVERSION')
       AND NEW.election_id IS NULL THEN
      RAISE EXCEPTION 'Explicit election required' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Reversal must exactly invert the original processing row
  IF NEW.reversal_of IS NOT NULL THEN
    SELECT * INTO orig
      FROM ca_processing WHERE processing_id = NEW.reversal_of FOR UPDATE;
    IF NOT FOUND THEN RETURN NEW; END IF;

    IF orig.status <> 'PROCESSED'
       OR orig.reversal_of IS NOT NULL
       OR (NEW.ca_id, NEW.portfolio_id, NEW.security_id, NEW.currency)
            IS DISTINCT FROM
          (orig.ca_id, orig.portfolio_id, orig.security_id, orig.currency)
       OR NEW.before_state <> orig.after_state
       OR NEW.after_state  <> orig.before_state
       OR NEW.cash_movement <> -orig.cash_movement
       OR NEW.before_receivable_value IS DISTINCT FROM orig.after_receivable_value
       OR NEW.after_receivable_value  IS DISTINCT FROM orig.before_receivable_value
       OR ROW(NEW.before_quantity, NEW.after_quantity,
              NEW.before_avg_cost, NEW.after_avg_cost,
              NEW.before_cost_basis, NEW.after_cost_basis,
              NEW.before_cash, NEW.after_cash,
              NEW.before_market_value, NEW.after_market_value)
          IS DISTINCT FROM
          ROW(orig.after_quantity, orig.before_quantity,
              orig.after_avg_cost, orig.before_avg_cost,
              orig.after_cost_basis, orig.before_cost_basis,
              orig.after_cash, orig.before_cash,
              orig.after_market_value, orig.before_market_value)
    THEN
      RAISE EXCEPTION 'Reversal must exactly invert a processed original'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER processing_guard
  BEFORE INSERT OR UPDATE ON ca_processing
  FOR EACH ROW EXECUTE FUNCTION check_processing();

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCESSING AUDIT: auto-populate audit_logs on ca_processing INSERT/UPDATE
-- SECURITY DEFINER so it can write audit_logs even when the app role cannot
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION audit_processing()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = corporate_actions, pg_catalog AS $$
DECLARE
  original_audit bigint;
BEGIN
  IF NEW.reversal_of IS NOT NULL THEN
    SELECT max(audit_id) INTO original_audit
      FROM audit_logs WHERE processing_id = NEW.reversal_of;
  END IF;

  INSERT INTO audit_logs (
    processing_id, ca_id, security_id, portfolio_id,
    action, outcome, processing_date, rule_applied,
    before_state, after_state, cash_movement,
    performed_by, reason, reversal_of
  ) VALUES (
    NEW.processing_id, NEW.ca_id, NEW.security_id, NEW.portfolio_id,
    CASE WHEN NEW.reversal_of IS NOT NULL THEN 'REVERSAL'
         ELSE 'PROCESSING_' || TG_OP END,
    NEW.status,
    NEW.processing_date,
    NEW.rule_applied,
    NEW.before_state || jsonb_build_object(
      'quantity',      NEW.before_quantity,
      'avg_cost',      NEW.before_avg_cost,
      'cost_basis',    NEW.before_cost_basis,
      'cash',          NEW.before_cash,
      'market_value',  NEW.before_market_value
    ),
    NEW.after_state || jsonb_build_object(
      'quantity',      NEW.after_quantity,
      'avg_cost',      NEW.after_avg_cost,
      'cost_basis',    NEW.after_cost_basis,
      'cash',          NEW.after_cash,
      'market_value',  NEW.after_market_value
    ),
    NEW.cash_movement,
    NEW.processed_by,
    coalesce(NEW.reversal_reason, NEW.error_reason),
    original_audit
  );

  -- Mark the original row as REVERSED when a reversal is inserted
  IF NEW.reversal_of IS NOT NULL THEN
    UPDATE ca_processing SET status = 'REVERSED'
      WHERE processing_id = NEW.reversal_of;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION audit_processing() FROM PUBLIC;

CREATE TRIGGER processing_audit
  AFTER INSERT OR UPDATE ON ca_processing
  FOR EACH ROW EXECUTE FUNCTION audit_processing();

-- ─────────────────────────────────────────────────────────────────────────────
-- SETTLEMENT VALIDATION: must link to valid processing; strict state machine
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION check_settlement()
RETURNS trigger LANGUAGE plpgsql
SET search_path = corporate_actions, pg_catalog AS $$
DECLARE
  p    ca_processing;
  orig settlements;
BEGIN
  SELECT * INTO p
    FROM ca_processing WHERE processing_id = NEW.processing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF p.status NOT IN ('PENDING','PROCESSED') THEN
    RAISE EXCEPTION 'Invalid processing status for settlement'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    OLD.status <> 'PENDING'
    OR NEW.status NOT IN ('SETTLED','CANCELLED')
    OR (to_jsonb(OLD) - ARRAY['status','settled_at'])
       <> (to_jsonb(NEW) - ARRAY['status','settled_at'])
  ) THEN
    RAISE EXCEPTION 'Invalid settlement transition or changed terms'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.reversal_of IS NOT NULL THEN
    SELECT * INTO orig
      FROM settlements WHERE settlement_id = NEW.reversal_of FOR UPDATE;
    IF NOT FOUND THEN RETURN NEW; END IF;
    IF orig.reversal_of IS NOT NULL
       OR orig.status <> 'SETTLED'
       OR p.reversal_of IS DISTINCT FROM orig.processing_id
       OR NEW.portfolio_id   <> orig.portfolio_id
       OR NEW.security_id    IS DISTINCT FROM orig.security_id
       OR NEW.currency        <> orig.currency
       OR NEW.cash_movement   <> -orig.cash_movement
       OR NEW.quantity_movement <> -orig.quantity_movement
       OR NEW.cost_basis_movement IS DISTINCT FROM -orig.cost_basis_movement
    THEN
      RAISE EXCEPTION 'Invalid reversal settlement'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER settlement_guard
  BEFORE INSERT OR UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION check_settlement();

-- ─────────────────────────────────────────────────────────────────────────────
-- SETTLEMENT AUDIT: auto-populate audit_logs on settlements INSERT/UPDATE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION audit_settlement()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = corporate_actions, pg_catalog AS $$
DECLARE
  p ca_processing;
BEGIN
  SELECT * INTO STRICT p
    FROM ca_processing WHERE processing_id = NEW.processing_id;

  INSERT INTO audit_logs (
    processing_id, ca_id, security_id, portfolio_id,
    action, outcome, processing_date, rule_applied,
    before_state, after_state, cash_movement,
    performed_by, reason
  ) VALUES (
    p.processing_id, p.ca_id, p.security_id, p.portfolio_id,
    'SETTLEMENT_' || TG_OP,
    p.status,
    p.processing_date,
    p.rule_applied,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END,
    to_jsonb(NEW),
    CASE WHEN NEW.status = 'SETTLED' THEN NEW.cash_movement ELSE 0 END,
    p.processed_by,
    'Settlement leg ' || NEW.leg_code
  );

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION audit_settlement() FROM PUBLIC;

CREATE TRIGGER settlement_audit
  AFTER INSERT OR UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION audit_settlement();
