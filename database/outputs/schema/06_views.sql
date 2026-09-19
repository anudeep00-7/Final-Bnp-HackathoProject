SET search_path=corporate_actions,pg_catalog;
CREATE VIEW current_positions AS SELECT DISTINCT ON(portfolio_id,security_id) * FROM positions ORDER BY portfolio_id,security_id,as_of_date DESC;
CREATE VIEW current_cash_balances AS SELECT DISTINCT ON(portfolio_id,currency) * FROM cash_balances ORDER BY portfolio_id,currency,as_of_date DESC;
CREATE VIEW settlement_forecast AS
 SELECT portfolio_id,currency,settlement_date,settlement_type,security_id,
 sum(cash_movement) AS cash_movement,sum(quantity_movement) AS quantity_movement
 FROM settlements WHERE status='PENDING' GROUP BY portfolio_id,currency,settlement_date,settlement_type,security_id;
CREATE VIEW processing_reconciliation AS
 SELECT processing_id,ca_id,portfolio_id,status,
 before_market_value+before_cash+before_receivable_value AS before_total,
 after_market_value+after_cash+after_receivable_value AS after_total,
 (after_market_value+after_cash+after_receivable_value)-
 (before_market_value+before_cash+before_receivable_value) AS observed_difference,
 expected_leakage,reconciliation_difference
 FROM ca_processing;
CREATE FUNCTION can_view_portfolio(p_user text,p_portfolio text) RETURNS boolean
 LANGUAGE sql STABLE SET search_path=corporate_actions,pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM users u WHERE u.user_id=p_user AND u.is_active AND
 (u.role='ADMIN' OR EXISTS(SELECT 1 FROM user_portfolios a WHERE a.user_id=u.user_id AND a.portfolio_id=p_portfolio)))
 $$;
REVOKE ALL ON ALL TABLES IN SCHEMA corporate_actions FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA corporate_actions FROM PUBLIC;
