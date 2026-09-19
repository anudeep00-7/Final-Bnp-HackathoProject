# Data dictionary

Generated from the implemented SQL AST. This is not a live database catalog assertion.
All columns appear below. `finite_numeric` is an unconstrained PostgreSQL NUMERIC domain rejecting NaN and infinities.
Composite keys/unique groups are identified as groups, not as individually unique columns. Identity keys are generated always.
Additional CHECK/trigger rules are defined in schema/03_constraints.sql and DATABASE_DESIGN.md.

## securities

Primary key: `security_id`.

| Column | Data type | Nullable | PK | FK | Unique | Description | Origin |
|---|---|---|---|---|---|---|---|
| security_id | text | No | Yes | — | PK group | Stable security identifier; symbol/name may change without changing this key. | SOURCE DATA: D1 securities.csv |
| symbol | text | No | No | — | No | Display trading symbol; source does not establish global symbol uniqueness. | SOURCE DATA: D1 securities.csv |
| name | text | No | No | — | No | Security display name. | SOURCE DATA: D1 securities.csv |
| type | text | No | No | — | No | Instrument classification from D1. | SOURCE DATA: D1 securities.csv |
| currency | text | No | No | — | No | Currency of this record or monetary snapshot; three uppercase letters. | SOURCE DATA: D1 securities.csv |
| underlying_security_id | text | Yes | No | — | No | Underlying/reference security; also identifies spin-off parent in D1. | SOURCE DATA: D1 securities.csv |
| status | text | No | No | — | No | Record lifecycle status; see design for table-specific allowed values. | SOURCE DATA: D1 securities.csv |

## portfolios

Primary key: `portfolio_id`.

| Column | Data type | Nullable | PK | FK | Unique | Description | Origin |
|---|---|---|---|---|---|---|---|
| portfolio_id | text | No | Yes | — | PK group | Stable portfolio identifier. | SOURCE DATA: D2 portfolios.csv |
| portfolio_name | text | No | No | — | No | Portfolio display name. | SOURCE DATA: D2 portfolios.csv |
| client_id | text | No | No | — | No | Source client identifier; no client master file was supplied. | SOURCE DATA: D2 portfolios.csv |
| client_type | text | No | No | — | No | Source client category. | SOURCE DATA: D2 portfolios.csv |
| base_currency | text | No | No | — | No | Portfolio reporting currency. | SOURCE DATA: D2 portfolios.csv |

## users

Primary key: `user_id`.

| Column | Data type | Nullable | PK | FK | Unique | Description | Origin |
|---|---|---|---|---|---|---|---|
| user_id | text | No | Yes | — | PK group | Application/external identity key. | APPLICATION-GENERATED DATA |
| display_name | text | No | No | — | No | Human-readable user name, not a credential. | APPLICATION-GENERATED DATA |
| role | text | No | No | — | No | ADMIN or ANALYST as required by specification. | APPLICATION-GENERATED DATA |
| auth_subject | text | Yes | No | — | Yes | Unique external identity-provider subject; no passwords stored. | APPLICATION-GENERATED DATA |
| is_active | bool | No | No | — | No | Whether backend may authorize this user. | APPLICATION-GENERATED DATA |
| created_at | timestamp with time zone | No | No | — | No | Record creation timestamp with time zone. | APPLICATION-GENERATED DATA |

## user_portfolios

Primary key: `user_id, portfolio_id`.

| Column | Data type | Nullable | PK | FK | Unique | Description | Origin |
|---|---|---|---|---|---|---|---|
| user_id | text | No | Yes | users(user_id) via (user_id) | PK group | Application/external identity key. | APPLICATION-GENERATED DATA |
| portfolio_id | text | No | Yes | portfolios(portfolio_id) via (portfolio_id) | PK group | Stable portfolio identifier. | APPLICATION-GENERATED DATA |

## positions

Primary key: `portfolio_id, security_id, as_of_date`.

| Column | Data type | Nullable | PK | FK | Unique | Description | Origin |
|---|---|---|---|---|---|---|---|
| portfolio_id | text | No | Yes | portfolios(portfolio_id) via (portfolio_id) | PK group | Stable portfolio identifier. | SOURCE DATA: D3 positions.csv |
| security_id | text | No | Yes | securities(security_id) via (security_id) | PK group | Stable security identifier; symbol/name may change without changing this key. | SOURCE DATA: D3 positions.csv |
| qty | finite_numeric | No | No | — | No | Settled snapshot quantity; nonnegative for supplied long-only universe. | SOURCE DATA: D3 positions.csv |
| avg_cost | finite_numeric | No | No | — | No | Snapshot unit cost; total basis should be preserved separately in processing. | SOURCE DATA: D3 positions.csv |
| as_of_date | date | No | Yes | — | PK group | Historical snapshot date; part of the natural key. | SOURCE DATA: D3 positions.csv |

## cash_balances

Primary key: `portfolio_id, currency, as_of_date`.

| Column | Data type | Nullable | PK | FK | Unique | Description | Origin |
|---|---|---|---|---|---|---|---|
| portfolio_id | text | No | Yes | portfolios(portfolio_id) via (portfolio_id) | PK group | Stable portfolio identifier. | SOURCE DATA: D4 cash_balances.csv |
| currency | text | No | Yes | — | PK group | Currency of this record or monetary snapshot; three uppercase letters. | SOURCE DATA: D4 cash_balances.csv |
| balance | finite_numeric | No | No | — | No | Cash balance, can be negative for an explicit overdraft policy. | SOURCE DATA: D4 cash_balances.csv |
| as_of_date | date | No | Yes | — | PK group | Historical snapshot date; part of the natural key. | SOURCE DATA: D4 cash_balances.csv |

## prices

Primary key: `security_id, price_date`.

| Column | Data type | Nullable | PK | FK | Unique | Description | Origin |
|---|---|---|---|---|---|---|---|
| security_id | text | No | Yes | securities(security_id) via (security_id) | PK group | Stable security identifier; symbol/name may change without changing this key. | SOURCE DATA: D5 prices.csv |
| price_date | date | No | Yes | — | PK group | Source price date; part of the natural key. | SOURCE DATA: D5 prices.csv |
| close_price | finite_numeric | No | No | — | No | Source mark; preserve even where source note says opening/fair value. | SOURCE DATA: D5 prices.csv |
| note | text | Yes | No | — | No | Source price note, preserved verbatim after explicit parsing recovery. | SOURCE DATA: D5 prices.csv |

## corporate_action_events

Primary key: `ca_id`.

| Column | Data type | Nullable | PK | FK | Unique | Description | Origin |
|---|---|---|---|---|---|---|---|
| ca_id | text | No | Yes | — | group (ca_id, security_id) | Stable corporate-action event identifier. | SOURCE DATA: D6 corporate_actions.csv |
| security_id | text | No | No | securities(security_id) via (security_id) | group (ca_id, security_id) | Stable security identifier; symbol/name may change without changing this key. | SOURCE DATA: D6 corporate_actions.csv |
| action_type | text | No | No | — | No | One of the 13 observed action types. | SOURCE DATA: D6 corporate_actions.csv |
| tier | smallint | No | No | — | No | Source hackathon complexity tier 1–3. | SOURCE DATA: D6 corporate_actions.csv |
| status | text | No | No | — | No | Record lifecycle status; see design for table-specific allowed values. | SOURCE DATA: D6 corporate_actions.csv |
| ex_date | date | No | No | — | No | Source entitlement/effective date; operational semantics depend on action. | SOURCE DATA: D6 corporate_actions.csv |
| record_date | date | Yes | No | — | No | Source holder-confirmation date; nullable for name change. | SOURCE DATA: D6 corporate_actions.csv |
| pay_date | date | Yes | No | — | No | Source payment/distribution date; nullable for name change. | SOURCE DATA: D6 corporate_actions.csv |
| election_deadline | date | Yes | No | — | No | Last permitted source election date (inclusive). No time zone/cutoff time supplied. | SOURCE DATA: D6 corporate_actions.csv |
| ratio_numerator | finite_numeric | Yes | No | — | No | Positive numerator of source share ratio. | SOURCE DATA: D6 corporate_actions.csv |
| ratio_denominator | finite_numeric | Yes | No | — | No | Positive denominator of source share ratio. | SOURCE DATA: D6 corporate_actions.csv |
| cash_rate_per_share | finite_numeric | Yes | No | — | No | Source stated cash rate; CA005 conflicts with notes and is gated. | SOURCE DATA: D6 corporate_actions.csv |
| subscription_price | finite_numeric | Yes | No | — | No | Cash per exercised rights share. | SOURCE DATA: D6 corporate_actions.csv |
| offer_price | finite_numeric | Yes | No | — | No | Cash per accepted tender share. | SOURCE DATA: D6 corporate_actions.csv |
| new_security_id | text | Yes | No | securities(security_id) via (new_security_id) | No | Resulting/acquirer/child/underlying security. | SOURCE DATA: D6 corporate_actions.csv |
| cost_basis_allocation_pct | finite_numeric | Yes | No | — | No | Percentage of original basis allocated to resulting security (0–100). | SOURCE DATA: D6 corporate_actions.csv |
| tax_withholding_pct | finite_numeric | Yes | No | — | No | Withholding percentage (0–100), not a decimal fraction. | SOURCE DATA: D6 corporate_actions.csv |
| notes | text | Yes | No | — | No | Source narrative preserved; not an executable rule. | SOURCE DATA: D6 corporate_actions.csv |

## event_terms

Primary key: `ca_id`.

| Column | Data type | Nullable | PK | FK | Unique | Description | Origin |
|---|---|---|---|---|---|---|---|
| ca_id | text | No | Yes | corporate_action_events(ca_id) via (ca_id) | PK group | Stable corporate-action event identifier. | APPLICATION-GENERATED DATA |
| announcement_date | date | Yes | No | — | No | Optional announcement date; none supplied, never synthesized. | APPLICATION-GENERATED DATA |
| parent_ca_id | text | Yes | No | corporate_action_events(ca_id) via (parent_ca_id) | No | Related dividend for DRIP; proposed CA010 → CA001 linkage. | APPLICATION-GENERATED DATA |
| supersedes_ca_id | text | Yes | No | corporate_action_events(ca_id) via (supersedes_ca_id) | No | Prior event corrected by a distinct new event ID. | APPLICATION-GENERATED DATA |
| new_name | text | Yes | No | — | No | Proposed effective name derived from source note, subject to review. | APPLICATION-GENERATED DATA |
| new_symbol | text | Yes | No | — | No | Proposed effective symbol derived from source note, subject to review. | APPLICATION-GENERATED DATA |
| reinvestment_price | finite_numeric | Yes | No | — | No | Proposed DRIP price from source note, subject to review. | APPLICATION-GENERATED DATA |
| tender_cap_pct | finite_numeric | Yes | No | — | No | Proposed cap from source note; final acceptance/proration still required. | APPLICATION-GENERATED DATA |
| policy | jsonb | No | No | — | No | Reviewed eligibility, recognition, precision, fraction and accounting policy with provenance/version. | APPLICATION-GENERATED DATA |
| processing_block_reason | text | No | No | — | No | Nonempty reason prevents processing; empty requires reviewed_by, reviewed_at and policy. | APPLICATION-GENERATED DATA |
| reviewed_by | text | Yes | No | users(user_id) via (reviewed_by) | No | Application user who approved supplemental terms/policy. | APPLICATION-GENERATED DATA |
| reviewed_at | timestamp with time zone | Yes | No | — | No | Review timestamp. | APPLICATION-GENERATED DATA |
| provenance | text | No | No | — | No | Source/workbook reference for supplemental terms. | APPLICATION-GENERATED DATA |

## ca_elections

Primary key: `election_id`.

| Column | Data type | Nullable | PK | FK | Unique | Description | Origin |
|---|---|---|---|---|---|---|---|
| election_id | text | No | Yes | — | group (election_id, ca_id, portfolio_id) | Stable election ID; processing FK also verifies action and portfolio. | SOURCE DATA: D7 ca_elections.csv |
| ca_id | text | No | No | corporate_action_events(ca_id) via (ca_id) | group (ca_id, portfolio_id); group (election_id, ca_id, portfolio_id) | Stable corporate-action event identifier. | SOURCE DATA: D7 ca_elections.csv |
| portfolio_id | text | No | No | portfolios(portfolio_id) via (portfolio_id) | group (ca_id, portfolio_id); group (election_id, ca_id, portfolio_id) | Stable portfolio identifier. | SOURCE DATA: D7 ca_elections.csv |
| election_type | text | No | No | — | No | SUBSCRIBE/LAPSE/SELL/TENDER/DRIP/CASH/CONVERT constrained by event type. | SOURCE DATA: D7 ca_elections.csv |
| elected_qty | finite_numeric | Yes | No | — | No | Instruction quantity; positive for exercise/sale/tender/conversion, zero for lapse, null for DRIP/cash. | SOURCE DATA: D7 ca_elections.csv |
| election_date | date | No | No | — | No | Source date of instruction. | SOURCE DATA: D7 ca_elections.csv |
| status | text | No | No | — | No | Record lifecycle status; see design for table-specific allowed values. | SOURCE DATA: D7 ca_elections.csv |
| notes | text | Yes | No | — | No | Source narrative preserved; not an executable rule. | SOURCE DATA: D7 ca_elections.csv |

## ca_processing

Primary key: `processing_id`.

| Column | Data type | Nullable | PK | FK | Unique | Description | Origin |
|---|---|---|---|---|---|---|---|
| processing_id | bigint | No | Yes | — | group (processing_id, ca_id, portfolio_id, security_id); group (processing_id, portfolio_id) | Database-generated processing attempt identifier. | APPLICATION-GENERATED DATA |
| ca_id | text | No | No | corporate_action_events(ca_id, security_id) via (ca_id, security_id); ca_elections(election_id, ca_id, portfolio_id) via (election_id, ca_id, portfolio_id) | group (processing_id, ca_id, portfolio_id, security_id) | Stable corporate-action event identifier. | APPLICATION-GENERATED DATA |
| portfolio_id | text | No | No | portfolios(portfolio_id) via (portfolio_id); ca_elections(election_id, ca_id, portfolio_id) via (election_id, ca_id, portfolio_id) | group (processing_id, ca_id, portfolio_id, security_id); group (processing_id, portfolio_id) | Stable portfolio identifier. | APPLICATION-GENERATED DATA |
| security_id | text | No | No | securities(security_id) via (security_id); corporate_action_events(ca_id, security_id) via (ca_id, security_id) | group (processing_id, ca_id, portfolio_id, security_id) | Stable security identifier; symbol/name may change without changing this key. | APPLICATION-GENERATED DATA |
| election_id | text | Yes | No | ca_elections(election_id, ca_id, portfolio_id) via (election_id, ca_id, portfolio_id) | No | Stable election ID; processing FK also verifies action and portfolio. | APPLICATION-GENERATED DATA |
| status | text | No | No | — | No | Record lifecycle status; see design for table-specific allowed values. | APPLICATION-GENERATED DATA |
| processing_date | timestamp with time zone | No | No | — | No | Recorded processing timestamp, separate from economic effective date. | APPLICATION-GENERATED DATA |
| effective_date | date | No | No | — | No | Economic posting date selected by reviewed rules. | APPLICATION-GENERATED DATA |
| rule_applied | text | No | No | — | No | Human-readable calculation/validation rule reference. | APPLICATION-GENERATED DATA |
| rule_version | text | No | No | — | No | Version identifier of service rule/policy. | APPLICATION-GENERATED DATA |
| eligible_qty | finite_numeric | Yes | No | — | No | Eligibility snapshot quantity used by calculator. | APPLICATION-GENERATED DATA |
| eligibility_date | date | Yes | No | — | No | Date used to establish eligible quantity. | APPLICATION-GENERATED DATA |
| before_quantity | finite_numeric | Yes | No | — | No | Primary-security quantity before this adjustment. | APPLICATION-GENERATED DATA |
| after_quantity | finite_numeric | Yes | No | — | No | Primary-security quantity after this adjustment. | APPLICATION-GENERATED DATA |
| before_avg_cost | finite_numeric | Yes | No | — | No | Primary-security unit cost before adjustment. | APPLICATION-GENERATED DATA |
| after_avg_cost | finite_numeric | Yes | No | — | No | Primary-security unit cost after adjustment. | APPLICATION-GENERATED DATA |
| before_cost_basis | finite_numeric | Yes | No | — | No | Exact total basis before adjustment (authoritative over rounded unit costs). | APPLICATION-GENERATED DATA |
| after_cost_basis | finite_numeric | Yes | No | — | No | Exact total basis after adjustment. | APPLICATION-GENERATED DATA |
| currency | text | No | No | — | No | Currency of this record or monetary snapshot; three uppercase letters. | APPLICATION-GENERATED DATA |
| before_cash | finite_numeric | Yes | No | — | No | Cash before adjustment in currency. | APPLICATION-GENERATED DATA |
| cash_movement | finite_numeric | No | No | — | No | Signed cash change: positive inflow, negative outflow; audit rows are lifecycle descriptions, not an additive ledger. | APPLICATION-GENERATED DATA |
| after_cash | finite_numeric | Yes | No | — | No | Cash after adjustment; must equal before_cash + cash_movement when supplied. | APPLICATION-GENERATED DATA |
| before_market_value | finite_numeric | Yes | No | — | No | Comparable marked value before adjustment; full multi-asset scope belongs in JSON. | APPLICATION-GENERATED DATA |
| after_market_value | finite_numeric | Yes | No | — | No | Comparable marked value after adjustment. | APPLICATION-GENERATED DATA |
| before_receivable_value | finite_numeric | Yes | No | — | No | Marked receivables/payables before adjustment; write explicit zero when none. | APPLICATION-GENERATED DATA |
| after_receivable_value | finite_numeric | Yes | No | — | No | Marked receivables/payables after adjustment; null means unknown. | APPLICATION-GENERATED DATA |
| reconciliation_difference | finite_numeric | Yes | No | — | No | Service-computed residual after explained movements/leakage. | APPLICATION-GENERATED DATA |
| expected_leakage | finite_numeric | Yes | No | — | No | Explained tax, rounding, fees or other approved difference. | APPLICATION-GENERATED DATA |
| before_state | jsonb | No | No | — | No | Complete versioned JSON object of affected book/reference state before the change. | APPLICATION-GENERATED DATA |
| after_state | jsonb | No | No | — | No | Complete versioned JSON object of affected book/reference state after the change. | APPLICATION-GENERATED DATA |
| error_reason | text | Yes | No | — | No | Required human-readable reason for FAILED or REJECTED processing. | APPLICATION-GENERATED DATA |
| processed_by | text | No | No | users(user_id) via (processed_by) | No | Application user accountable for processing; backend authenticates it. | APPLICATION-GENERATED DATA |
| reversal_of | bigint | Yes | No | ca_processing(processing_id) via (reversal_of) | Yes | Link to original row in the same table; prevents duplicate processing/settlement reversal. | APPLICATION-GENERATED DATA |
| reversal_reason | text | Yes | No | — | No | Nonblank reason required for inverse processing. | APPLICATION-GENERATED DATA |
| created_at | timestamp with time zone | No | No | — | No | Record creation timestamp with time zone. | APPLICATION-GENERATED DATA |

## settlements

Primary key: `settlement_id`.

| Column | Data type | Nullable | PK | FK | Unique | Description | Origin |
|---|---|---|---|---|---|---|---|
| settlement_id | bigint | No | Yes | — | PK group | Database-generated settlement-leg identifier. | APPLICATION-GENERATED DATA |
| processing_id | bigint | No | No | ca_processing(processing_id, portfolio_id) via (processing_id, portfolio_id) | group (processing_id, leg_code) | Database-generated processing attempt identifier. | APPLICATION-GENERATED DATA |
| portfolio_id | text | No | No | portfolios(portfolio_id) via (portfolio_id); ca_processing(processing_id, portfolio_id) via (processing_id, portfolio_id) | No | Stable portfolio identifier. | APPLICATION-GENERATED DATA |
| security_id | text | Yes | No | securities(security_id) via (security_id) | No | Stable security identifier; symbol/name may change without changing this key. | APPLICATION-GENERATED DATA |
| leg_code | text | No | No | — | group (processing_id, leg_code) | Unique leg name within processing (e.g. GROSS, TAX, SHARES). | APPLICATION-GENERATED DATA |
| settlement_type | text | No | No | — | No | CASH or SECURITY; only matching movement is nonzero. | APPLICATION-GENERATED DATA |
| quantity_movement | finite_numeric | No | No | — | No | Signed delivered/removed security quantity. | APPLICATION-GENERATED DATA |
| cash_movement | finite_numeric | No | No | — | No | Signed cash change: positive inflow, negative outflow; audit rows are lifecycle descriptions, not an additive ledger. | APPLICATION-GENERATED DATA |
| currency | text | No | No | — | No | Currency of this record or monetary snapshot; three uppercase letters. | APPLICATION-GENERATED DATA |
| recognition_date | date | No | No | — | No | Date receivable/payable is recognized under approved policy. | APPLICATION-GENERATED DATA |
| settlement_date | date | No | No | — | No | Forecast or actual economic settlement date. | APPLICATION-GENERATED DATA |
| settled_at | timestamp with time zone | Yes | No | — | No | System confirmation timestamp; required iff SETTLED. | APPLICATION-GENERATED DATA |
| status | text | No | No | — | No | Record lifecycle status; see design for table-specific allowed values. | APPLICATION-GENERATED DATA |
| cost_basis_movement | finite_numeric | Yes | No | — | No | Signed total basis delivered or removed by this leg. | APPLICATION-GENERATED DATA |
| reversal_of | bigint | Yes | No | settlements(settlement_id) via (reversal_of) | Yes | Link to original row in the same table; prevents duplicate processing/settlement reversal. | APPLICATION-GENERATED DATA |

## audit_logs

Primary key: `audit_id`.

| Column | Data type | Nullable | PK | FK | Unique | Description | Origin |
|---|---|---|---|---|---|---|---|
| audit_id | bigint | No | Yes | — | PK group | Database-generated append-only audit identifier. | APPLICATION-GENERATED DATA |
| processing_id | bigint | No | No | ca_processing(processing_id, ca_id, portfolio_id, security_id) via (processing_id, ca_id, portfolio_id, security_id) | No | Database-generated processing attempt identifier. | APPLICATION-GENERATED DATA |
| ca_id | text | No | No | corporate_action_events(ca_id) via (ca_id); ca_processing(processing_id, ca_id, portfolio_id, security_id) via (processing_id, ca_id, portfolio_id, security_id) | No | Stable corporate-action event identifier. | APPLICATION-GENERATED DATA |
| security_id | text | No | No | securities(security_id) via (security_id); ca_processing(processing_id, ca_id, portfolio_id, security_id) via (processing_id, ca_id, portfolio_id, security_id) | No | Stable security identifier; symbol/name may change without changing this key. | APPLICATION-GENERATED DATA |
| portfolio_id | text | No | No | portfolios(portfolio_id) via (portfolio_id); ca_processing(processing_id, ca_id, portfolio_id, security_id) via (processing_id, ca_id, portfolio_id, security_id) | No | Stable portfolio identifier. | APPLICATION-GENERATED DATA |
| action | text | No | No | — | No | Trigger-generated lifecycle action (PROCESSING_* / SETTLEMENT_* / REVERSAL). | APPLICATION-GENERATED DATA |
| outcome | text | No | No | — | No | Processing lifecycle outcome at audit time. | APPLICATION-GENERATED DATA |
| processing_date | timestamp with time zone | No | No | — | No | Recorded processing timestamp, separate from economic effective date. | APPLICATION-GENERATED DATA |
| rule_applied | text | No | No | — | No | Human-readable calculation/validation rule reference. | APPLICATION-GENERATED DATA |
| before_state | jsonb | No | No | — | No | Complete versioned JSON object of affected book/reference state before the change. | APPLICATION-GENERATED DATA |
| after_state | jsonb | No | No | — | No | Complete versioned JSON object of affected book/reference state after the change. | APPLICATION-GENERATED DATA |
| cash_movement | finite_numeric | No | No | — | No | Signed cash change: positive inflow, negative outflow; audit rows are lifecycle descriptions, not an additive ledger. | APPLICATION-GENERATED DATA |
| performed_by | text | No | No | users(user_id) via (performed_by) | No | Application processing actor; settlement lifecycle inherits its processing actor. | APPLICATION-GENERATED DATA |
| occurred_at | timestamp with time zone | No | No | — | No | Database timestamp when audit record was emitted. | APPLICATION-GENERATED DATA |
| reason | text | Yes | No | — | No | Failure/rejection/reversal reason or settlement leg explanation. | APPLICATION-GENERATED DATA |
| reversal_of | bigint | Yes | No | audit_logs(audit_id) via (reversal_of) | No | Original audit record linked by reversal processing; multiple lifecycle references allowed. | APPLICATION-GENERATED DATA |

