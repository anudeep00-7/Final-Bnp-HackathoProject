SET search_path=corporate_actions,pg_catalog;
CREATE FUNCTION audit_settlement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=corporate_actions,pg_catalog AS $$
DECLARE p ca_processing;
BEGIN
 SELECT * INTO STRICT p FROM ca_processing WHERE processing_id=NEW.processing_id;
 INSERT INTO audit_logs(processing_id,ca_id,security_id,portfolio_id,action,outcome,processing_date,rule_applied,before_state,after_state,cash_movement,performed_by,reason)
 VALUES(p.processing_id,p.ca_id,p.security_id,p.portfolio_id,'SETTLEMENT_'||TG_OP,p.status,p.processing_date,p.rule_applied,
 CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END,to_jsonb(NEW),
 CASE WHEN NEW.status='SETTLED' THEN NEW.cash_movement ELSE 0 END,p.processed_by,'Settlement leg '||NEW.leg_code);
 RETURN NEW;
END $$;
CREATE TRIGGER settlement_audit AFTER INSERT OR UPDATE ON settlements FOR EACH ROW EXECUTE FUNCTION audit_settlement();
REVOKE ALL ON FUNCTION audit_settlement() FROM PUBLIC;
