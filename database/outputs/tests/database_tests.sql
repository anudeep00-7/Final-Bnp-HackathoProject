-- Run against the imported fixture database. All test writes roll back.
-- psql -X -v ON_ERROR_STOP=1 -f tests/database_tests.sql "$DATABASE_URL"
BEGIN;
SET LOCAL search_path=corporate_actions,pg_catalog;
CREATE FUNCTION pg_temp.assert_true(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION pg_temp.expect_error(query text,expected_state text,label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
 BEGIN EXECUTE query;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS actual=RETURNED_SQLSTATE;
  IF actual=expected_state THEN RAISE NOTICE 'PASS: %',label; RETURN; END IF;
  RAISE EXCEPTION 'FAIL %: expected %, got % (%)',label,expected_state,actual,SQLERRM;
 END;
 RAISE EXCEPTION 'FAIL %: statement unexpectedly succeeded',label;
END $$;
SELECT pg_temp.assert_true((SELECT count(*)=14 FROM securities),'14 imported securities');
SELECT pg_temp.assert_true((SELECT count(*)=8 FROM portfolios),'8 imported portfolios');
SELECT pg_temp.assert_true((SELECT count(*)=27 FROM positions),'27 imported positions');
SELECT pg_temp.assert_true((SELECT count(*)=8 FROM cash_balances),'8 imported cash balances');
SELECT pg_temp.assert_true((SELECT count(*)=41 FROM prices),'41 imported prices');
SELECT pg_temp.assert_true((SELECT count(*)=16 FROM corporate_action_events),'16 imported events');
SELECT pg_temp.assert_true((SELECT count(*)=9 FROM ca_elections),'9 imported elections');
SELECT pg_temp.assert_true((SELECT tax_withholding_pct=15 FROM corporate_action_events WHERE ca_id='CA010'),'CA010 repair');
INSERT INTO users(user_id,display_name,role) VALUES ('TEST_ADMIN','Test only','ADMIN');
UPDATE event_terms SET processing_block_reason='',reviewed_by='TEST_ADMIN',reviewed_at=clock_timestamp(),
 policy='{"test_only":true,"rounding":"HALF_EVEN","cash_scale":2,"eligibility":"supplied bootstrap"}'
 WHERE ca_id IN ('CA001','CA002','CA003','CA008','CA014','CA016');
SELECT pg_temp.expect_error($q$INSERT INTO securities SELECT * FROM securities WHERE security_id='SEC001'$q$,'23505','primary key');
SELECT pg_temp.expect_error($q$INSERT INTO positions VALUES ('P001','SEC001',1,1,'2026-01-01')$q$,'23505','duplicate position');
SELECT pg_temp.expect_error($q$INSERT INTO prices VALUES ('SEC001','2026-01-01',1,'test')$q$,'23505','duplicate price');
SELECT pg_temp.expect_error($q$INSERT INTO positions VALUES ('MISSING','SEC001',1,1,'2026-01-01')$q$,'23503','invalid portfolio');
SELECT pg_temp.expect_error($q$INSERT INTO positions VALUES ('P001','MISSING',1,1,'2026-01-01')$q$,'23503','invalid security');
SELECT pg_temp.expect_error($q$INSERT INTO positions VALUES ('P001','SEC001',NULL,1,'2027-01-01')$q$,'23502','required quantity');
SELECT pg_temp.expect_error($q$INSERT INTO positions VALUES ('P001','SEC001','NaN',1,'2027-01-01')$q$,'23514','nonfinite quantity');
SELECT pg_temp.expect_error($q$INSERT INTO ca_elections VALUES ('TEST_E','MISSING','P001','SUBSCRIBE',1,'2026-01-01','CONFIRMED',NULL)$q$,'23503','invalid action reference');
SELECT pg_temp.expect_error($q$INSERT INTO ca_elections VALUES ('TEST_E','CA008','P001','TENDER',1,'2026-04-01','CONFIRMED',NULL)$q$,'23514','wrong election type');
SELECT pg_temp.expect_error($q$INSERT INTO ca_elections VALUES ('TEST_E','CA008','P001','SUBSCRIBE',1,'2026-04-21','CONFIRMED',NULL)$q$,'23514','late election');
SELECT pg_temp.expect_error($q$INSERT INTO ca_elections VALUES ('TEST_E','CA008','P001','SUBSCRIBE',0,'2026-04-01','CONFIRMED',NULL)$q$,'23514','zero subscription');
SELECT pg_temp.expect_error($q$INSERT INTO ca_processing(ca_id,portfolio_id,security_id,election_id,status,effective_date,rule_applied,rule_version,currency,processed_by,error_reason) VALUES ('CA008','P003','SEC008','MISSING','FAILED','2026-04-25','test','1','USD','TEST_ADMIN','test')$q$,'23503','invalid election reference');
SELECT pg_temp.expect_error($q$INSERT INTO ca_processing(ca_id,portfolio_id,security_id,election_id,status,effective_date,rule_applied,rule_version,currency,processed_by,error_reason) VALUES ('CA008','P003','SEC008','E002','FAILED','2026-04-25','test','1','USD','TEST_ADMIN','test')$q$,'23503','election belongs to another portfolio');
SELECT pg_temp.expect_error($q$INSERT INTO ca_processing(ca_id,portfolio_id,security_id,status,effective_date,rule_applied,rule_version,currency,processed_by) VALUES ('CA001','P001','SEC001','INVALID','2026-02-01','test','1','USD','TEST_ADMIN')$q$,'23514','processing status validation');
SELECT pg_temp.expect_error($q$INSERT INTO ca_processing(ca_id,portfolio_id,security_id,status,effective_date,rule_applied,rule_version,currency,processed_by) VALUES ('CA016','P003','SEC008','PENDING','2026-04-25','test','1','USD','TEST_ADMIN')$q$,'23514','source REVERSED event cannot process');
SELECT pg_temp.expect_error($q$INSERT INTO ca_processing(ca_id,portfolio_id,security_id,status,effective_date,rule_applied,rule_version,currency,processed_by) VALUES ('CA005','P002','SEC002','PENDING','2026-03-10','test','1','USD','TEST_ADMIN')$q$,'23514','unreviewed terms block processing');
INSERT INTO ca_processing(ca_id,portfolio_id,security_id,status,effective_date,rule_applied,rule_version,currency,processed_by)
 VALUES ('CA001','P001','SEC001','PENDING','2026-02-01','Workbook rows 7-10; test policy','1','USD','TEST_ADMIN');
SELECT pg_temp.expect_error($q$INSERT INTO ca_processing(ca_id,portfolio_id,security_id,status,effective_date,rule_applied,rule_version,currency,processed_by) VALUES ('CA001','P001','SEC001','PENDING','2026-02-01','test','1','USD','TEST_ADMIN')$q$,'23505','duplicate processing');
SELECT pg_temp.expect_error($q$UPDATE ca_processing SET status='REVERSED' WHERE ca_id='CA001' AND portfolio_id='P001'$q$,'23514','invalid processing transition');
SELECT pg_temp.expect_error($q$UPDATE corporate_action_events SET status='CANCELLED' WHERE ca_id='CA001'$q$,'23514','event locked during processing');
UPDATE ca_processing SET status='PROCESSED',before_quantity=500,after_quantity=500,before_avg_cost=38,after_avg_cost=38,
 before_cost_basis=19000,after_cost_basis=19000,before_cash=15000,cash_movement=212.50,after_cash=15212.50,
 before_market_value=18850,after_market_value=18850,before_state='{"qty":500,"cash":15000}',after_state='{"qty":500,"cash":15212.50}'
 WHERE ca_id='CA001' AND portfolio_id='P001';
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM audit_logs WHERE ca_id='CA001' AND portfolio_id='P001'),'pending + processed audit records');
SELECT pg_temp.assert_true((SELECT bool_and(before_state ? 'cost_basis' AND after_state ? 'cost_basis') FROM audit_logs WHERE ca_id='CA001' AND portfolio_id='P001'),'audit states include basis');
SELECT pg_temp.expect_error($q$UPDATE ca_processing SET after_quantity=999 WHERE ca_id='CA001' AND portfolio_id='P001'$q$,'23514','completed processing immutable');
SELECT pg_temp.expect_error($q$DELETE FROM audit_logs$q$,'23514','audit immutable');
SELECT pg_temp.expect_error($q$INSERT INTO settlements(processing_id,portfolio_id,leg_code,settlement_type,cash_movement,currency,recognition_date,settlement_date) VALUES (-1,'P001','net','CASH',1,'USD','2026-01-15','2026-02-01')$q$,'23503','settlement processing FK');
SELECT pg_temp.expect_error($q$INSERT INTO settlements(processing_id,portfolio_id,leg_code,settlement_type,cash_movement,currency,recognition_date,settlement_date) SELECT processing_id,'P002','net','CASH',1,'USD','2026-01-15','2026-02-01' FROM ca_processing WHERE ca_id='CA001' AND portfolio_id='P001'$q$,'23503','settlement portfolio consistency');
INSERT INTO settlements(processing_id,portfolio_id,security_id,leg_code,settlement_type,cash_movement,currency,recognition_date,settlement_date,status,settled_at)
 SELECT processing_id,portfolio_id,security_id,'GROSS','CASH',250,'USD','2026-01-15','2026-02-01','SETTLED',clock_timestamp() FROM ca_processing WHERE ca_id='CA001' AND portfolio_id='P001';
INSERT INTO settlements(processing_id,portfolio_id,security_id,leg_code,settlement_type,cash_movement,currency,recognition_date,settlement_date,status,settled_at)
 SELECT processing_id,portfolio_id,security_id,'TAX','CASH',-37.50,'USD','2026-01-15','2026-02-01','SETTLED',clock_timestamp() FROM ca_processing WHERE ca_id='CA001' AND portfolio_id='P001';
SELECT pg_temp.assert_true((SELECT sum(cash_movement)=212.50 FROM settlements WHERE portfolio_id='P001'),'dividend settlement net');
SELECT pg_temp.expect_error($q$UPDATE settlements SET status='PENDING',settled_at=NULL WHERE portfolio_id='P001'$q$,'23514','settled legs immutable');
-- Test structural reversal without claiming to execute a book reversal.
INSERT INTO ca_processing(ca_id,portfolio_id,security_id,status,effective_date,rule_applied,rule_version,currency,processed_by,
 reversal_of,reversal_reason,before_quantity,after_quantity,before_avg_cost,after_avg_cost,before_cost_basis,after_cost_basis,before_cash,cash_movement,after_cash,
 before_market_value,after_market_value,before_state,after_state)
 SELECT ca_id,portfolio_id,security_id,'PROCESSED','2026-02-02',rule_applied,rule_version,currency,processed_by,
 processing_id,'Test exact inverse',after_quantity,before_quantity,after_avg_cost,before_avg_cost,after_cost_basis,before_cost_basis,after_cash,-cash_movement,before_cash,
 after_market_value,before_market_value,after_state,before_state FROM ca_processing WHERE ca_id='CA001' AND portfolio_id='P001' AND reversal_of IS NULL;
SELECT pg_temp.assert_true((SELECT status='REVERSED' FROM ca_processing WHERE ca_id='CA001' AND reversal_of IS NULL),'original linked to reversal');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM audit_logs WHERE action='REVERSAL' AND reversal_of IS NOT NULL),'linked reversal audit');
-- Formula assertions reference supplied values; Python suite tests the implementation, failures and policy.
SELECT pg_temp.assert_true((SELECT 200*ratio_numerator/ratio_denominator=400 FROM corporate_action_events WHERE ca_id='CA002'),'stock split ratio');
SELECT pg_temp.assert_true((SELECT 1000*(1+ratio_numerator/ratio_denominator)=1200 FROM corporate_action_events WHERE ca_id='CA003'),'bonus ratio');
SELECT pg_temp.assert_true((SELECT new_symbol='HRG' FROM event_terms WHERE ca_id='CA014'),'name change reference terms');
SELECT pg_temp.assert_true((SELECT elected_qty*subscription_price=1200 FROM ca_elections JOIN corporate_action_events USING(ca_id) WHERE election_id='E001'),'rights subscription cash');
SELECT pg_temp.assert_true((SELECT elected_qty=0 FROM ca_elections WHERE election_id='E002'),'rights decline');
ROLLBACK;
