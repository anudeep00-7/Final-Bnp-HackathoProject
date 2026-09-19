SET search_path=corporate_actions,pg_catalog;

-- Natural primary/unique keys already index portfolio-first histories, elections and most joins.

CREATE UNIQUE INDEX one_original_processing
ON ca_processing(ca_id,portfolio_id)
WHERE reversal_of IS NULL
  AND status IN ('PENDING','PROCESSED','REVERSED');

CREATE INDEX positions_security_date
ON positions(security_id,as_of_date);

CREATE INDEX events_calendar
ON corporate_action_events(ex_date,status);

CREATE INDEX events_security
ON corporate_action_events(security_id);

CREATE INDEX events_action_status
ON corporate_action_events(action_type,status);

CREATE INDEX events_record_date
ON corporate_action_events(record_date)
WHERE record_date IS NOT NULL;

CREATE INDEX events_pay_date
ON corporate_action_events(pay_date)
WHERE pay_date IS NOT NULL;

CREATE INDEX events_election_deadline
ON corporate_action_events(election_deadline)
WHERE election_deadline IS NOT NULL;

CREATE INDEX elections_portfolio
ON ca_elections(portfolio_id,ca_id);

CREATE INDEX processing_portfolio_date
ON ca_processing(portfolio_id,processing_date);

CREATE INDEX processing_status
ON ca_processing(status,processing_date);

CREATE INDEX idx_settlement_forecast
ON settlements(portfolio_id,settlement_date,status);

CREATE INDEX settlement_security
ON settlements(security_id)
WHERE security_id IS NOT NULL;

CREATE INDEX audit_portfolio_date
ON audit_logs(portfolio_id,occurred_at);

CREATE INDEX audit_event
ON audit_logs(ca_id);

CREATE INDEX audit_processing
ON audit_logs(processing_id);

CREATE INDEX audit_security
ON audit_logs(security_id,occurred_at);

CREATE INDEX assignments_portfolio
ON user_portfolios(portfolio_id);
