-- =============================================================================
-- V02_constraints.sql
-- ActiLedger → Supabase Migration
-- Phase: CHECK constraints, FK completions, business-rule enforcements
--
-- CHANGES FROM ORIGINAL 03_constraints.sql:
--   1. All PL/pgSQL trigger FUNCTIONS are moved to V03_triggers.sql to keep
--      this file purely declarative (easier to review / rerun independently).
--   2. CREATE TRIGGER statements are moved to V03_triggers.sql.
--   3. All CHECK constraints are otherwise unchanged from the original.
--   4. Supabase fully supports CHECK constraints and DOMAIN constraints.
-- =============================================================================

SET search_path = corporate_actions, pg_catalog;

-- ── securities ────────────────────────────────────────────────────────────────
ALTER TABLE securities
  ADD FOREIGN KEY (underlying_security_id) REFERENCES securities,
  ADD CHECK (type IN ('EQUITY','CONVERTIBLE_BOND','PREFERENCE_SHARE')),
  ADD CHECK (status IN ('ACTIVE','INACTIVE','DELISTED')),
  ADD CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CHECK (length(trim(security_id)) > 0
         AND length(trim(symbol)) > 0
         AND length(trim(name)) > 0),
  ADD CHECK (underlying_security_id IS DISTINCT FROM security_id);

-- ── portfolios ────────────────────────────────────────────────────────────────
ALTER TABLE portfolios
  ADD CHECK (base_currency ~ '^[A-Z]{3}$'),
  ADD CHECK (length(trim(portfolio_id)) > 0
         AND length(trim(portfolio_name)) > 0
         AND length(trim(client_id)) > 0),
  ADD CHECK (client_type IN ('INDIVIDUAL','PENSION','FAMILY_OFFICE',
                             'MUTUAL_FUND','ENDOWMENT','PROP_DESK'));

-- ── users ─────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD CHECK (role IN ('ADMIN','ANALYST')),
  ADD CHECK (length(trim(user_id)) > 0 AND length(trim(display_name)) > 0);

-- ── positions ─────────────────────────────────────────────────────────────────
ALTER TABLE positions
  ADD CHECK (qty >= 0 AND avg_cost >= 0);

-- ── cash_balances ─────────────────────────────────────────────────────────────
ALTER TABLE cash_balances
  ADD CHECK (currency ~ '^[A-Z]{3}$');

-- ── prices ────────────────────────────────────────────────────────────────────
ALTER TABLE prices
  ADD CHECK (close_price >= 0);

-- ── corporate_action_events ───────────────────────────────────────────────────
-- All 13 supported action types. CA016 (REVERSED) is imported as source status.
ALTER TABLE corporate_action_events
  ADD CHECK (action_type IN (
    'CASH_DIVIDEND','STOCK_SPLIT','BONUS_ISSUE','STOCK_DIVIDEND',
    'MERGER','SPIN_OFF','DELISTING','RIGHTS_ISSUE','TENDER_OFFER',
    'DRIP_ELECTION','CONVERSION','REVERSE_SPLIT','NAME_CHANGE'
  )),
  ADD CHECK (status IN ('ACTIVE','REVERSED','REJECTED','INCOMPLETE','CANCELLED')),
  ADD CHECK (tier BETWEEN 1 AND 3),
  ADD CHECK (length(trim(ca_id)) > 0),
  -- Date ordering rules
  ADD CHECK (record_date IS NULL OR record_date >= ex_date),
  ADD CHECK (pay_date    IS NULL OR pay_date    >= ex_date),
  ADD CHECK (pay_date IS NULL OR record_date IS NULL OR pay_date >= record_date),
  ADD CHECK (election_deadline IS NULL OR pay_date IS NULL OR election_deadline <= pay_date),
  -- Ratio integrity: both present or both absent; must be positive if present
  ADD CHECK (ratio_numerator > 0 AND ratio_denominator > 0),
  ADD CHECK ((ratio_numerator IS NULL) = (ratio_denominator IS NULL)),
  -- Non-negative financial rates
  ADD CHECK (cash_rate_per_share >= 0 AND subscription_price >= 0 AND offer_price >= 0),
  ADD CHECK (cost_basis_allocation_pct BETWEEN 0 AND 100),
  ADD CHECK (tax_withholding_pct BETWEEN 0 AND 100),
  ADD CHECK (new_security_id IS DISTINCT FROM security_id),
  -- Field completeness rules (only enforced when status != INCOMPLETE)
  ADD CHECK (status = 'INCOMPLETE' OR action_type = 'NAME_CHANGE'
          OR (record_date IS NOT NULL AND pay_date IS NOT NULL)),
  ADD CHECK (status = 'INCOMPLETE'
          OR action_type NOT IN ('STOCK_SPLIT','REVERSE_SPLIT','BONUS_ISSUE',
                                  'STOCK_DIVIDEND','MERGER','SPIN_OFF',
                                  'RIGHTS_ISSUE','CONVERSION')
          OR ratio_numerator IS NOT NULL),
  ADD CHECK (status = 'INCOMPLETE'
          OR action_type NOT IN ('CASH_DIVIDEND','DELISTING','DRIP_ELECTION')
          OR cash_rate_per_share IS NOT NULL),
  ADD CHECK (status = 'INCOMPLETE' OR action_type <> 'RIGHTS_ISSUE' OR subscription_price IS NOT NULL),
  ADD CHECK (status = 'INCOMPLETE' OR action_type <> 'TENDER_OFFER'  OR offer_price IS NOT NULL),
  ADD CHECK (status = 'INCOMPLETE'
          OR action_type NOT IN ('MERGER','SPIN_OFF','CONVERSION')
          OR new_security_id IS NOT NULL),
  ADD CHECK (status = 'INCOMPLETE'
          OR action_type NOT IN ('RIGHTS_ISSUE','TENDER_OFFER','DRIP_ELECTION','CONVERSION')
          OR election_deadline IS NOT NULL);

-- ── event_terms ───────────────────────────────────────────────────────────────
ALTER TABLE event_terms
  ADD CHECK (parent_ca_id IS DISTINCT FROM ca_id
         AND supersedes_ca_id IS DISTINCT FROM ca_id),
  ADD CHECK (reinvestment_price > 0),
  ADD CHECK (tender_cap_pct BETWEEN 0 AND 100),
  ADD CHECK (jsonb_typeof(policy) = 'object'),
  -- Gate: cannot clear block_reason without a reviewed policy AND reviewer identity
  ADD CHECK (
    processing_block_reason <> '' OR (
      reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND policy <> '{}'::jsonb
    )
  );

-- ── ca_elections ──────────────────────────────────────────────────────────────
ALTER TABLE ca_elections
  ADD CHECK (status = 'CONFIRMED'),
  ADD CHECK (election_type IN ('SUBSCRIBE','LAPSE','SELL','TENDER','DRIP','CASH','CONVERT')),
  ADD CHECK (length(trim(election_id)) > 0),
  -- Quantity rules per election type
  ADD CHECK (
    (election_type IN ('SUBSCRIBE','SELL','TENDER','CONVERT')
     AND elected_qty IS NOT NULL AND elected_qty > 0)
    OR (election_type = 'LAPSE'
     AND elected_qty IS NOT NULL AND elected_qty = 0)
    OR (election_type IN ('DRIP','CASH')
     AND elected_qty IS NULL)
  );

-- ── ca_processing ─────────────────────────────────────────────────────────────
ALTER TABLE ca_processing
  ADD CHECK (status IN ('PENDING','PROCESSED','FAILED','REJECTED','REVERSED')),
  ADD CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CHECK (length(trim(rule_applied)) > 0 AND length(trim(rule_version)) > 0),
  ADD CHECK (jsonb_typeof(before_state) = 'object'
         AND jsonb_typeof(after_state)  = 'object'),
  ADD CHECK (eligible_qty >= 0 AND before_quantity >= 0 AND after_quantity >= 0
         AND before_avg_cost >= 0 AND after_avg_cost >= 0),
  -- Cash arithmetic must balance
  ADD CHECK (after_cash = before_cash + cash_movement),
  -- FAILED/REJECTED must carry a reason
  ADD CHECK (status NOT IN ('FAILED','REJECTED')
          OR nullif(trim(error_reason), '') IS NOT NULL),
  -- Reversal linkage rules
  ADD CHECK (reversal_of IS NULL
          OR (nullif(trim(reversal_reason), '') IS NOT NULL
              AND status = 'PROCESSED')),
  ADD CHECK (reversal_of IS DISTINCT FROM processing_id),
  -- Full snapshots required for terminal states
  ADD CHECK (
    status NOT IN ('PROCESSED','REVERSED')
    OR (
      before_quantity IS NOT NULL AND after_quantity IS NOT NULL
      AND before_avg_cost IS NOT NULL AND after_avg_cost IS NOT NULL
      AND before_cost_basis IS NOT NULL AND after_cost_basis IS NOT NULL
      AND before_cash IS NOT NULL AND after_cash IS NOT NULL
      AND before_market_value IS NOT NULL AND after_market_value IS NOT NULL
      AND before_state <> '{}'::jsonb AND after_state <> '{}'::jsonb
    )
  );

-- ── settlements ───────────────────────────────────────────────────────────────
ALTER TABLE settlements
  ADD CHECK (settlement_type IN ('CASH','SECURITY')),
  ADD CHECK (status IN ('PENDING','SETTLED','CANCELLED')),
  ADD CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CHECK (length(trim(leg_code)) > 0),
  ADD CHECK (settlement_date >= recognition_date),
  -- settled_at must be set if and only if status = 'SETTLED'
  ADD CHECK ((status = 'SETTLED') = (settled_at IS NOT NULL)),
  -- Leg type invariants: cash legs have no quantity movement; security legs vice versa
  ADD CHECK (
    (settlement_type = 'CASH'
     AND cash_movement <> 0
     AND quantity_movement = 0)
    OR
    (settlement_type = 'SECURITY'
     AND security_id IS NOT NULL
     AND quantity_movement <> 0
     AND cash_movement = 0)
  );

-- ── audit_logs ────────────────────────────────────────────────────────────────
ALTER TABLE audit_logs
  ADD CHECK (outcome IN ('PENDING','PROCESSED','FAILED','REJECTED','REVERSED')),
  ADD CHECK (jsonb_typeof(before_state) = 'object'
         AND jsonb_typeof(after_state)  = 'object');
