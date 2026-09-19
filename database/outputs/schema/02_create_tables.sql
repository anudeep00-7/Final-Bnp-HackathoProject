SET search_path = corporate_actions, pg_catalog;
CREATE TABLE securities (
 security_id text PRIMARY KEY, symbol text NOT NULL, name text NOT NULL,
 type text NOT NULL, currency text NOT NULL, underlying_security_id text, status text NOT NULL
);
CREATE TABLE portfolios (
 portfolio_id text PRIMARY KEY, portfolio_name text NOT NULL, client_id text NOT NULL,
 client_type text NOT NULL, base_currency text NOT NULL
);
CREATE TABLE users (
 user_id text PRIMARY KEY, display_name text NOT NULL, role text NOT NULL,
 auth_subject text UNIQUE, is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE user_portfolios (
 user_id text NOT NULL REFERENCES users, portfolio_id text NOT NULL REFERENCES portfolios,
 PRIMARY KEY(user_id,portfolio_id)
);
CREATE TABLE positions (
 portfolio_id text NOT NULL REFERENCES portfolios, security_id text NOT NULL REFERENCES securities,
 qty finite_numeric NOT NULL, avg_cost finite_numeric NOT NULL, as_of_date date NOT NULL,
 PRIMARY KEY(portfolio_id,security_id,as_of_date)
);
CREATE TABLE cash_balances (
 portfolio_id text NOT NULL REFERENCES portfolios, currency text NOT NULL,
 balance finite_numeric NOT NULL, as_of_date date NOT NULL,
 PRIMARY KEY(portfolio_id,currency,as_of_date)
);
CREATE TABLE prices (
 security_id text NOT NULL REFERENCES securities, price_date date NOT NULL,
 close_price finite_numeric NOT NULL, note text,
 PRIMARY KEY(security_id,price_date)
);
CREATE TABLE corporate_action_events (
 ca_id text PRIMARY KEY, security_id text NOT NULL REFERENCES securities,
 action_type text NOT NULL, tier smallint NOT NULL, status text NOT NULL,
 ex_date date NOT NULL, record_date date, pay_date date, election_deadline date,
 ratio_numerator finite_numeric, ratio_denominator finite_numeric,
 cash_rate_per_share finite_numeric, subscription_price finite_numeric, offer_price finite_numeric,
 new_security_id text REFERENCES securities, cost_basis_allocation_pct finite_numeric,
 tax_withholding_pct finite_numeric, notes text,
 UNIQUE(ca_id,security_id)
);
CREATE TABLE event_terms (
 ca_id text PRIMARY KEY REFERENCES corporate_action_events,
 announcement_date date, parent_ca_id text REFERENCES corporate_action_events,
 supersedes_ca_id text REFERENCES corporate_action_events,
 new_name text, new_symbol text, reinvestment_price finite_numeric,
 tender_cap_pct finite_numeric, policy jsonb NOT NULL DEFAULT '{}'::jsonb,
 processing_block_reason text NOT NULL DEFAULT 'Eligibility, recognition and rounding policy require review',
 reviewed_by text REFERENCES users, reviewed_at timestamptz, provenance text NOT NULL
);
CREATE TABLE ca_elections (
 election_id text PRIMARY KEY, ca_id text NOT NULL REFERENCES corporate_action_events,
 portfolio_id text NOT NULL REFERENCES portfolios, election_type text NOT NULL,
 elected_qty finite_numeric, election_date date NOT NULL, status text NOT NULL, notes text,
 UNIQUE(ca_id,portfolio_id), UNIQUE(election_id,ca_id,portfolio_id)
);
CREATE TABLE ca_processing (
 processing_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 ca_id text NOT NULL, portfolio_id text NOT NULL REFERENCES portfolios,
 security_id text NOT NULL REFERENCES securities, election_id text,
 status text NOT NULL DEFAULT 'PENDING', processing_date timestamptz NOT NULL DEFAULT clock_timestamp(),
 effective_date date NOT NULL, rule_applied text NOT NULL, rule_version text NOT NULL,
 eligible_qty finite_numeric, eligibility_date date,
 before_quantity finite_numeric, after_quantity finite_numeric,
 before_avg_cost finite_numeric, after_avg_cost finite_numeric,
 before_cost_basis finite_numeric, after_cost_basis finite_numeric,
 currency text NOT NULL,
 before_cash finite_numeric, cash_movement finite_numeric NOT NULL DEFAULT 0, after_cash finite_numeric,
 before_market_value finite_numeric, after_market_value finite_numeric,
 before_receivable_value finite_numeric, after_receivable_value finite_numeric,
 reconciliation_difference finite_numeric, expected_leakage finite_numeric,
 before_state jsonb NOT NULL DEFAULT '{}'::jsonb, after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
 error_reason text, processed_by text NOT NULL REFERENCES users,
 reversal_of bigint UNIQUE REFERENCES ca_processing, reversal_reason text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(ca_id,security_id) REFERENCES corporate_action_events(ca_id,security_id),
 FOREIGN KEY(election_id,ca_id,portfolio_id) REFERENCES ca_elections(election_id,ca_id,portfolio_id),
 UNIQUE(processing_id,ca_id,portfolio_id,security_id), UNIQUE(processing_id,portfolio_id)
);
CREATE TABLE settlements (
 settlement_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 processing_id bigint NOT NULL, portfolio_id text NOT NULL REFERENCES portfolios,
 security_id text REFERENCES securities, leg_code text NOT NULL,
 settlement_type text NOT NULL, quantity_movement finite_numeric NOT NULL DEFAULT 0,
 cash_movement finite_numeric NOT NULL DEFAULT 0, currency text NOT NULL,
 recognition_date date NOT NULL, settlement_date date NOT NULL, settled_at timestamptz,
 status text NOT NULL DEFAULT 'PENDING', cost_basis_movement finite_numeric,
 reversal_of bigint UNIQUE REFERENCES settlements,
 FOREIGN KEY(processing_id,portfolio_id) REFERENCES ca_processing(processing_id,portfolio_id),
 UNIQUE(processing_id,leg_code)
);
CREATE TABLE audit_logs (
 audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 processing_id bigint NOT NULL, ca_id text NOT NULL REFERENCES corporate_action_events,
 security_id text NOT NULL REFERENCES securities, portfolio_id text NOT NULL REFERENCES portfolios,
 action text NOT NULL, outcome text NOT NULL, processing_date timestamptz NOT NULL,
 rule_applied text NOT NULL, before_state jsonb NOT NULL, after_state jsonb NOT NULL,
 cash_movement finite_numeric NOT NULL, performed_by text NOT NULL REFERENCES users,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(), reason text,
 reversal_of bigint REFERENCES audit_logs,
 FOREIGN KEY(processing_id,ca_id,portfolio_id,security_id)
 REFERENCES ca_processing(processing_id,ca_id,portfolio_id,security_id)
);
