# ER diagram

Generated from implemented CREATE TABLE and ALTER TABLE foreign-key definitions.

```mermaid
erDiagram
    securities {
        text security_id PK
        text symbol
        text name
        text type
        text currency
        text underlying_security_id
        text status
    }
    portfolios {
        text portfolio_id PK
        text portfolio_name
        text client_id
        text client_type
        text base_currency
    }
    users {
        text user_id PK
        text display_name
        text role
        text auth_subject UK
        bool is_active
        timestamp_with_time_zone created_at
    }
    user_portfolios {
        text user_id PK,FK
        text portfolio_id PK,FK
    }
    users ||--o{ user_portfolios : "user_id"
    portfolios ||--o{ user_portfolios : "portfolio_id"
    positions {
        text portfolio_id PK,FK
        text security_id PK,FK
        finite_numeric qty
        finite_numeric avg_cost
        date as_of_date PK
    }
    portfolios ||--o{ positions : "portfolio_id"
    securities ||--o{ positions : "security_id"
    cash_balances {
        text portfolio_id PK,FK
        text currency PK
        finite_numeric balance
        date as_of_date PK
    }
    portfolios ||--o{ cash_balances : "portfolio_id"
    prices {
        text security_id PK,FK
        date price_date PK
        finite_numeric close_price
        text note
    }
    securities ||--o{ prices : "security_id"
    corporate_action_events {
        text ca_id PK,UK
        text security_id FK,UK
        text action_type
        smallint tier
        text status
        date ex_date
        date record_date
        date pay_date
        date election_deadline
        finite_numeric ratio_numerator
        finite_numeric ratio_denominator
        finite_numeric cash_rate_per_share
        finite_numeric subscription_price
        finite_numeric offer_price
        text new_security_id FK
        finite_numeric cost_basis_allocation_pct
        finite_numeric tax_withholding_pct
        text notes
    }
    securities ||--o{ corporate_action_events : "security_id"
    securities o|--o{ corporate_action_events : "new_security_id"
    event_terms {
        text ca_id PK,FK
        date announcement_date
        text parent_ca_id FK
        text supersedes_ca_id FK
        text new_name
        text new_symbol
        finite_numeric reinvestment_price
        finite_numeric tender_cap_pct
        jsonb policy
        text processing_block_reason
        text reviewed_by FK
        timestamp_with_time_zone reviewed_at
        text provenance
    }
    corporate_action_events ||--o| event_terms : "ca_id"
    corporate_action_events o|--o{ event_terms : "parent_ca_id"
    corporate_action_events o|--o{ event_terms : "supersedes_ca_id"
    users o|--o{ event_terms : "reviewed_by"
    ca_elections {
        text election_id PK,UK
        text ca_id FK,UK
        text portfolio_id FK,UK
        text election_type
        finite_numeric elected_qty
        date election_date
        text status
        text notes
    }
    corporate_action_events ||--o{ ca_elections : "ca_id"
    portfolios ||--o{ ca_elections : "portfolio_id"
    ca_processing {
        bigint processing_id PK,UK
        text ca_id FK,UK
        text portfolio_id FK,UK
        text security_id FK,UK
        text election_id FK
        text status
        timestamp_with_time_zone processing_date
        date effective_date
        text rule_applied
        text rule_version
        finite_numeric eligible_qty
        date eligibility_date
        finite_numeric before_quantity
        finite_numeric after_quantity
        finite_numeric before_avg_cost
        finite_numeric after_avg_cost
        finite_numeric before_cost_basis
        finite_numeric after_cost_basis
        text currency
        finite_numeric before_cash
        finite_numeric cash_movement
        finite_numeric after_cash
        finite_numeric before_market_value
        finite_numeric after_market_value
        finite_numeric before_receivable_value
        finite_numeric after_receivable_value
        finite_numeric reconciliation_difference
        finite_numeric expected_leakage
        jsonb before_state
        jsonb after_state
        text error_reason
        text processed_by FK
        bigint reversal_of FK,UK
        text reversal_reason
        timestamp_with_time_zone created_at
    }
    portfolios ||--o{ ca_processing : "portfolio_id"
    securities ||--o{ ca_processing : "security_id"
    users ||--o{ ca_processing : "processed_by"
    ca_processing o|--o| ca_processing : "reversal_of"
    corporate_action_events ||--o{ ca_processing : "ca_id, security_id"
    ca_elections o|--o{ ca_processing : "election_id, ca_id, portfolio_id"
    settlements {
        bigint settlement_id PK
        bigint processing_id FK,UK
        text portfolio_id FK
        text security_id FK
        text leg_code UK
        text settlement_type
        finite_numeric quantity_movement
        finite_numeric cash_movement
        text currency
        date recognition_date
        date settlement_date
        timestamp_with_time_zone settled_at
        text status
        finite_numeric cost_basis_movement
        bigint reversal_of FK,UK
    }
    portfolios ||--o{ settlements : "portfolio_id"
    securities o|--o{ settlements : "security_id"
    settlements o|--o| settlements : "reversal_of"
    ca_processing ||--o{ settlements : "processing_id, portfolio_id"
    audit_logs {
        bigint audit_id PK
        bigint processing_id FK
        text ca_id FK
        text security_id FK
        text portfolio_id FK
        text action
        text outcome
        timestamp_with_time_zone processing_date
        text rule_applied
        jsonb before_state
        jsonb after_state
        finite_numeric cash_movement
        text performed_by FK
        timestamp_with_time_zone occurred_at
        text reason
        bigint reversal_of FK
    }
    corporate_action_events ||--o{ audit_logs : "ca_id"
    securities ||--o{ audit_logs : "security_id"
    portfolios ||--o{ audit_logs : "portfolio_id"
    users ||--o{ audit_logs : "performed_by"
    audit_logs o|--o{ audit_logs : "reversal_of"
    ca_processing ||--o{ audit_logs : "processing_id, ca_id, portfolio_id, security_id"
```

Self-links preserve security lineage, event correction/DRIP relationships and immutable reversal history.
