SET search_path = corporate_actions, pg_catalog;
ALTER TABLE securities ADD FOREIGN KEY(underlying_security_id) REFERENCES securities;
ALTER TABLE securities ADD CHECK(type IN ('EQUITY','CONVERTIBLE_BOND','PREFERENCE_SHARE')),
 ADD CHECK(status IN ('ACTIVE','INACTIVE','DELISTED')), ADD CHECK(currency ~ '^[A-Z]{3}$'),
 ADD CHECK(length(trim(security_id))>0 AND length(trim(symbol))>0 AND length(trim(name))>0),
 ADD CHECK(underlying_security_id IS DISTINCT FROM security_id);
ALTER TABLE portfolios ADD CHECK(base_currency ~ '^[A-Z]{3}$'),
 ADD CHECK(length(trim(portfolio_id))>0 AND length(trim(portfolio_name))>0 AND length(trim(client_id))>0),
 ADD CHECK(client_type IN ('INDIVIDUAL','PENSION','FAMILY_OFFICE','MUTUAL_FUND','ENDOWMENT','PROP_DESK'));
ALTER TABLE users ADD CHECK(role IN ('ADMIN','ANALYST')), ADD CHECK(length(trim(user_id))>0 AND length(trim(display_name))>0);
ALTER TABLE positions ADD CHECK(qty>=0 AND avg_cost>=0);
ALTER TABLE cash_balances ADD CHECK(currency ~ '^[A-Z]{3}$');
ALTER TABLE prices ADD CHECK(close_price>=0);
ALTER TABLE corporate_action_events ADD CHECK(action_type IN
 ('CASH_DIVIDEND','STOCK_SPLIT','BONUS_ISSUE','STOCK_DIVIDEND','MERGER','SPIN_OFF','DELISTING','RIGHTS_ISSUE','TENDER_OFFER','DRIP_ELECTION','CONVERSION','REVERSE_SPLIT','NAME_CHANGE')),
 ADD CHECK(status IN ('ACTIVE','REVERSED','REJECTED','INCOMPLETE','CANCELLED')),
 ADD CHECK(tier BETWEEN 1 AND 3), ADD CHECK(length(trim(ca_id))>0),
 ADD CHECK(record_date IS NULL OR record_date>=ex_date),
 ADD CHECK(pay_date IS NULL OR pay_date>=ex_date),
 ADD CHECK(pay_date IS NULL OR record_date IS NULL OR pay_date>=record_date),
 ADD CHECK(election_deadline IS NULL OR pay_date IS NULL OR election_deadline<=pay_date),
 ADD CHECK(ratio_numerator>0 AND ratio_denominator>0),
 ADD CHECK((ratio_numerator IS NULL)=(ratio_denominator IS NULL)),
 ADD CHECK(cash_rate_per_share>=0 AND subscription_price>=0 AND offer_price>=0),
 ADD CHECK(cost_basis_allocation_pct BETWEEN 0 AND 100), ADD CHECK(tax_withholding_pct BETWEEN 0 AND 100),
 ADD CHECK(new_security_id IS DISTINCT FROM security_id),
 ADD CHECK(status='INCOMPLETE' OR action_type='NAME_CHANGE' OR (record_date IS NOT NULL AND pay_date IS NOT NULL)),
 ADD CHECK(status='INCOMPLETE' OR action_type NOT IN ('STOCK_SPLIT','REVERSE_SPLIT','BONUS_ISSUE','STOCK_DIVIDEND','MERGER','SPIN_OFF','RIGHTS_ISSUE','CONVERSION') OR ratio_numerator IS NOT NULL),
 ADD CHECK(status='INCOMPLETE' OR action_type NOT IN ('CASH_DIVIDEND','DELISTING','DRIP_ELECTION') OR cash_rate_per_share IS NOT NULL),
 ADD CHECK(status='INCOMPLETE' OR action_type<>'RIGHTS_ISSUE' OR subscription_price IS NOT NULL),
 ADD CHECK(status='INCOMPLETE' OR action_type<>'TENDER_OFFER' OR offer_price IS NOT NULL),
 ADD CHECK(status='INCOMPLETE' OR action_type NOT IN ('MERGER','SPIN_OFF','CONVERSION') OR new_security_id IS NOT NULL),
 ADD CHECK(status='INCOMPLETE' OR action_type NOT IN ('RIGHTS_ISSUE','TENDER_OFFER','DRIP_ELECTION','CONVERSION') OR election_deadline IS NOT NULL);
ALTER TABLE event_terms ADD CHECK(parent_ca_id IS DISTINCT FROM ca_id AND supersedes_ca_id IS DISTINCT FROM ca_id),
 ADD CHECK(reinvestment_price>0), ADD CHECK(tender_cap_pct BETWEEN 0 AND 100),
 ADD CHECK(jsonb_typeof(policy)='object'),
 ADD CHECK(processing_block_reason<>'' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND policy<>'{}'::jsonb));
ALTER TABLE ca_elections ADD CHECK(status='CONFIRMED'),
 ADD CHECK(election_type IN ('SUBSCRIBE','LAPSE','SELL','TENDER','DRIP','CASH','CONVERT')),
 ADD CHECK(length(trim(election_id))>0),
 ADD CHECK((election_type IN ('SUBSCRIBE','SELL','TENDER','CONVERT') AND elected_qty IS NOT NULL AND elected_qty>0)
 OR (election_type='LAPSE' AND elected_qty IS NOT NULL AND elected_qty=0)
 OR (election_type IN ('DRIP','CASH') AND elected_qty IS NULL));
ALTER TABLE ca_processing ADD CHECK(status IN ('PENDING','PROCESSED','FAILED','REJECTED','REVERSED')),
 ADD CHECK(currency ~ '^[A-Z]{3}$'), ADD CHECK(length(trim(rule_applied))>0 AND length(trim(rule_version))>0),
 ADD CHECK(jsonb_typeof(before_state)='object' AND jsonb_typeof(after_state)='object'),
 ADD CHECK(eligible_qty>=0 AND before_quantity>=0 AND after_quantity>=0 AND before_avg_cost>=0 AND after_avg_cost>=0),
 ADD CHECK(after_cash=before_cash+cash_movement),
 ADD CHECK(status NOT IN ('FAILED','REJECTED') OR nullif(trim(error_reason),'') IS NOT NULL),
 ADD CHECK(reversal_of IS NULL OR (nullif(trim(reversal_reason),'') IS NOT NULL AND status='PROCESSED')),
 ADD CHECK(reversal_of IS DISTINCT FROM processing_id),
 ADD CHECK(status NOT IN ('PROCESSED','REVERSED') OR
 (before_quantity IS NOT NULL AND after_quantity IS NOT NULL AND before_avg_cost IS NOT NULL AND after_avg_cost IS NOT NULL
 AND before_cost_basis IS NOT NULL AND after_cost_basis IS NOT NULL AND before_cash IS NOT NULL AND after_cash IS NOT NULL
 AND before_market_value IS NOT NULL AND after_market_value IS NOT NULL AND before_state<>'{}'::jsonb AND after_state<>'{}'::jsonb));
ALTER TABLE settlements ADD CHECK(settlement_type IN ('CASH','SECURITY')),
 ADD CHECK(status IN ('PENDING','SETTLED','CANCELLED')), ADD CHECK(currency ~ '^[A-Z]{3}$'),
 ADD CHECK(length(trim(leg_code))>0), ADD CHECK(settlement_date>=recognition_date),
 ADD CHECK((status='SETTLED')=(settled_at IS NOT NULL)),
 ADD CHECK((settlement_type='CASH' AND cash_movement<>0 AND quantity_movement=0)
 OR (settlement_type='SECURITY' AND security_id IS NOT NULL AND quantity_movement<>0 AND cash_movement=0));
ALTER TABLE audit_logs ADD CHECK(outcome IN ('PENDING','PROCESSED','FAILED','REJECTED','REVERSED')),
 ADD CHECK(jsonb_typeof(before_state)='object' AND jsonb_typeof(after_state)='object');

CREATE FUNCTION prevent_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% history is immutable',TG_TABLE_NAME USING ERRCODE='23514'; END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_logs FOR EACH STATEMENT EXECUTE FUNCTION prevent_mutation();
CREATE TRIGGER processing_no_delete BEFORE DELETE OR TRUNCATE ON ca_processing FOR EACH STATEMENT EXECUTE FUNCTION prevent_mutation();
CREATE TRIGGER settlement_no_delete BEFORE DELETE OR TRUNCATE ON settlements FOR EACH STATEMENT EXECUTE FUNCTION prevent_mutation();

CREATE FUNCTION check_election() RETURNS trigger LANGUAGE plpgsql SET search_path=corporate_actions,pg_catalog AS $$
DECLARE e corporate_action_events;
BEGIN
 SELECT * INTO e FROM corporate_action_events WHERE ca_id=NEW.ca_id FOR SHARE;
 IF NOT FOUND THEN RETURN NEW; END IF; -- FK supplies precise missing-reference error
 IF e.status<>'ACTIVE' OR NEW.election_date>e.election_deadline OR e.election_deadline IS NULL THEN
 RAISE EXCEPTION 'Event inactive or election after deadline' USING ERRCODE='23514'; END IF;
 IF NOT ((e.action_type='RIGHTS_ISSUE' AND NEW.election_type IN ('SUBSCRIBE','SELL','LAPSE'))
 OR (e.action_type='TENDER_OFFER' AND NEW.election_type='TENDER')
 OR (e.action_type='DRIP_ELECTION' AND NEW.election_type IN ('CASH','DRIP'))
 OR (e.action_type='CONVERSION' AND NEW.election_type='CONVERT')) THEN
 RAISE EXCEPTION 'Election incompatible with action type' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM ca_processing WHERE ca_id=NEW.ca_id AND portfolio_id=NEW.portfolio_id AND status IN ('PENDING','PROCESSED','REVERSED')) THEN
 RAISE EXCEPTION 'Election locked by processing' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER election_guard BEFORE INSERT OR UPDATE ON ca_elections FOR EACH ROW EXECUTE FUNCTION check_election();

CREATE FUNCTION check_event_transition() RETURNS trigger LANGUAGE plpgsql SET search_path=corporate_actions,pg_catalog AS $$
BEGIN
 IF OLD.status<>NEW.status AND NOT
 ((OLD.status='ACTIVE' AND NEW.status IN ('REJECTED','INCOMPLETE','CANCELLED','REVERSED'))
 OR (OLD.status='INCOMPLETE' AND NEW.status IN ('ACTIVE','REJECTED','CANCELLED'))) THEN
 RAISE EXCEPTION 'Invalid event status transition' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM ca_processing WHERE ca_id=OLD.ca_id AND status IN ('PENDING','PROCESSED')) THEN
 RAISE EXCEPTION 'Cannot edit event while pending or unreversed processing exists' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER event_guard BEFORE UPDATE ON corporate_action_events FOR EACH ROW EXECUTE FUNCTION check_event_transition();

CREATE FUNCTION check_processing() RETURNS trigger LANGUAGE plpgsql SET search_path=corporate_actions,pg_catalog AS $$
DECLARE e corporate_action_events; orig ca_processing; block text;
BEGIN
 SELECT * INTO e FROM corporate_action_events WHERE ca_id=NEW.ca_id FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW; END IF;
 PERFORM 1 FROM portfolios WHERE portfolio_id=NEW.portfolio_id FOR UPDATE;
 IF TG_OP='UPDATE' THEN
  IF OLD.status<>'PENDING' AND NOT (OLD.status='PROCESSED' AND NEW.status='REVERSED' AND OLD.reversal_of IS NULL
   AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status')) THEN
   RAISE EXCEPTION 'Completed processing is immutable' USING ERRCODE='23514'; END IF;
  IF OLD.status='PENDING' AND (NEW.status NOT IN ('PROCESSED','FAILED','REJECTED') OR
   (OLD.ca_id,OLD.portfolio_id,OLD.security_id,OLD.election_id,OLD.reversal_of) IS DISTINCT FROM
   (NEW.ca_id,NEW.portfolio_id,NEW.security_id,NEW.election_id,NEW.reversal_of)) THEN
   RAISE EXCEPTION 'Invalid processing transition/context' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.status='REVERSED' AND NOT EXISTS(SELECT 1 FROM ca_processing WHERE reversal_of=NEW.processing_id) THEN
  RAISE EXCEPTION 'Linked reversal required' USING ERRCODE='23514'; END IF;
 IF NEW.reversal_of IS NULL AND NEW.status IN ('PENDING','PROCESSED') THEN
  IF e.status<>'ACTIVE' THEN RAISE EXCEPTION 'Event is not ACTIVE' USING ERRCODE='23514'; END IF;
  SELECT processing_block_reason INTO block FROM event_terms WHERE ca_id=NEW.ca_id;
  IF block IS DISTINCT FROM '' THEN RAISE EXCEPTION 'Unreviewed event terms: %',coalesce(block,'missing terms') USING ERRCODE='23514'; END IF;
  IF e.action_type IN ('RIGHTS_ISSUE','TENDER_OFFER','DRIP_ELECTION','CONVERSION') AND NEW.election_id IS NULL THEN
   RAISE EXCEPTION 'Explicit election required' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.reversal_of IS NOT NULL THEN
  SELECT * INTO orig FROM ca_processing WHERE processing_id=NEW.reversal_of FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF orig.status<>'PROCESSED' OR orig.reversal_of IS NOT NULL OR
   (NEW.ca_id,NEW.portfolio_id,NEW.security_id,NEW.currency) IS DISTINCT FROM (orig.ca_id,orig.portfolio_id,orig.security_id,orig.currency)
   OR NEW.before_state<>orig.after_state OR NEW.after_state<>orig.before_state OR NEW.cash_movement<>-orig.cash_movement
   OR NEW.before_receivable_value IS DISTINCT FROM orig.after_receivable_value
   OR NEW.after_receivable_value IS DISTINCT FROM orig.before_receivable_value
   OR ROW(NEW.before_quantity,NEW.after_quantity,NEW.before_avg_cost,NEW.after_avg_cost,NEW.before_cost_basis,NEW.after_cost_basis,NEW.before_cash,NEW.after_cash,NEW.before_market_value,NEW.after_market_value)
   IS DISTINCT FROM ROW(orig.after_quantity,orig.before_quantity,orig.after_avg_cost,orig.before_avg_cost,orig.after_cost_basis,orig.before_cost_basis,orig.after_cash,orig.before_cash,orig.after_market_value,orig.before_market_value) THEN
   RAISE EXCEPTION 'Reversal must exactly invert a processed original' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER processing_guard BEFORE INSERT OR UPDATE ON ca_processing FOR EACH ROW EXECUTE FUNCTION check_processing();

CREATE FUNCTION audit_processing() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=corporate_actions,pg_catalog AS $$
DECLARE original_audit bigint;
BEGIN
 IF NEW.reversal_of IS NOT NULL THEN SELECT max(audit_id) INTO original_audit FROM audit_logs WHERE processing_id=NEW.reversal_of; END IF;
 INSERT INTO audit_logs(processing_id,ca_id,security_id,portfolio_id,action,outcome,processing_date,rule_applied,before_state,after_state,cash_movement,performed_by,reason,reversal_of)
 VALUES(NEW.processing_id,NEW.ca_id,NEW.security_id,NEW.portfolio_id,
 CASE WHEN NEW.reversal_of IS NOT NULL THEN 'REVERSAL' ELSE 'PROCESSING_'||TG_OP END,
 NEW.status,NEW.processing_date,NEW.rule_applied,
 NEW.before_state || jsonb_build_object('quantity',NEW.before_quantity,'avg_cost',NEW.before_avg_cost,'cost_basis',NEW.before_cost_basis,'cash',NEW.before_cash,'market_value',NEW.before_market_value),
 NEW.after_state || jsonb_build_object('quantity',NEW.after_quantity,'avg_cost',NEW.after_avg_cost,'cost_basis',NEW.after_cost_basis,'cash',NEW.after_cash,'market_value',NEW.after_market_value),
 NEW.cash_movement,NEW.processed_by,coalesce(NEW.reversal_reason,NEW.error_reason),original_audit);
 IF NEW.reversal_of IS NOT NULL THEN UPDATE ca_processing SET status='REVERSED' WHERE processing_id=NEW.reversal_of; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER processing_audit AFTER INSERT OR UPDATE ON ca_processing FOR EACH ROW EXECUTE FUNCTION audit_processing();
REVOKE ALL ON FUNCTION audit_processing() FROM PUBLIC;

CREATE FUNCTION check_settlement() RETURNS trigger LANGUAGE plpgsql SET search_path=corporate_actions,pg_catalog AS $$
DECLARE p ca_processing; orig settlements;
BEGIN
 SELECT * INTO p FROM ca_processing WHERE processing_id=NEW.processing_id FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF p.status NOT IN ('PENDING','PROCESSED') THEN RAISE EXCEPTION 'Invalid processing status for settlement' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (OLD.status<>'PENDING' OR NEW.status NOT IN ('SETTLED','CANCELLED')
 OR (to_jsonb(OLD)-ARRAY['status','settled_at'])<>(to_jsonb(NEW)-ARRAY['status','settled_at'])) THEN
 RAISE EXCEPTION 'Invalid settlement transition or changed terms' USING ERRCODE='23514'; END IF;
 IF NEW.reversal_of IS NOT NULL THEN
 SELECT * INTO orig FROM settlements WHERE settlement_id=NEW.reversal_of FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF orig.reversal_of IS NOT NULL OR orig.status<>'SETTLED' OR p.reversal_of IS DISTINCT FROM orig.processing_id
 OR NEW.portfolio_id<>orig.portfolio_id OR NEW.security_id IS DISTINCT FROM orig.security_id
 OR NEW.currency<>orig.currency OR NEW.cash_movement<>-orig.cash_movement OR NEW.quantity_movement<>-orig.quantity_movement
 OR NEW.cost_basis_movement IS DISTINCT FROM -orig.cost_basis_movement THEN
 RAISE EXCEPTION 'Invalid reversal settlement' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER settlement_guard BEFORE INSERT OR UPDATE ON settlements FOR EACH ROW EXECUTE FUNCTION check_settlement();
