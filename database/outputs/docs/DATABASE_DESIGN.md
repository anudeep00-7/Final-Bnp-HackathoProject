# Database design

One PostgreSQL 17 database `corporate_actions_db`, schema `corporate_actions`.
The seven CSVs retain all original column names (D6 maps only its table name to corporate_action_events).
Source data is distinguished from application metadata in the dictionary.

## Model decisions

Opening positions, cash and prices use their observed composite natural keys. IDs remain text.
Unconstrained NUMERIC preserves source and calculation precision without silently rounding on insert.
Non-finite numeric values are forbidden. Rounding is an explicit service policy, never an invented workbook rule.
Users use external authentication subject identifiers, never passwords. Demo role selection is optional and is not authentication.
User-to-portfolio assignments are many-to-many, since Analysts can cover several portfolios. No users file was supplied.

The 11 requested tables are accompanied by `user_portfolios` (access assignments) and
`event_terms` (reviewed supplemental terms not supplied as CSV columns). Settlement rows model
outstanding receivables/payables and completed cash/security legs, including separate gross dividend,
tax, reinvestment and fractional legs. No raw notices table and no duplicate reversal table are needed.

Corporate action source status ACTIVE/REVERSED is independent of each portfolio's processing status.
Application event statuses REJECTED, INCOMPLETE, CANCELLED are grounded in specification page 3.
Processing statuses PENDING, PROCESSED, FAILED, REVERSED come from specification page 2, plus REJECTED from page 4.
Security INACTIVE/DELISTED are application lifecycle states for workbook restricted/delisted instruments; source ACTIVE is preserved.
Settlement PENDING/SETTLED/CANCELLED are application lifecycle names for workbook receivable/settlement states.
Election CONFIRMED is the only supplied status. A decline of rights maps to LAPSE with zero quantity;
full and partial subscriptions both use SUBSCRIBE with a validated quantity.
SELL is supported by workbook row 41, though no supplied election exercises it.

## Integrity and transaction boundary

Composite foreign keys keep portfolio, security, action, processing and election context consistent.
A partial unique index allows failed/rejected attempts but only one pending/successful/reversed original
processing per action/portfolio. A separate unique reversal link prevents repeated reversal.
Event locks serialize processing with event rejection; portfolio locks serialize book writers.
Triggers enforce transitions, lock completed processing and settlements, and emit append-only audit rows.
Processing snapshots include quantity, average and total basis, cash, market value, receivables and multi-security
state. A single-security summary must never replace the full JSON state for mergers/spin-offs/conversions.
Every processing write emits an audit row. A failed transaction cannot retain its own audit: record the failed
attempt in a separate transaction after rollback. Invalid FK attempts must be reported by the API/import report
because they cannot refer to nonexistent transactional entities.

Calculations remain in Python/backend code. The included pure Decimal calculator covers the five required core
actions as a reference/preview, with explicit rounding policy. It does not post holdings or constitute a full engine.
Backend posting must atomically lock/read holdings, validate eligibility/election/terms, write historical book state,
insert settlement legs, transition processing to PROCESSED and commit. Read BACKEND_CONTRACT.md.

## Reversal contract

Reversals use ca_processing.reversal_of and audit_logs.reversal_of, preserving original records.
Database structural guards require an original processed row, same context, inverse cash, swapped snapshots,
a reason, one reversal per original, and no reversal-of-reversal. These support a future backend reversal service.
No callable book-reversal procedure is shipped: structural checks alone cannot prove exact rollback of holdings.
The future service must reject dependent later adjustments, lock all affected assets/cash/reference rows, restore
exact persisted state and reverse all settlement legs in the same transaction. Corrections require a new event ID
linked through event_terms.supersedes_ca_id; never silently reprocess or delete the original event.

## Access boundary

Run migrations/imports as the database owner. PUBLIC receives no schema/table privileges.
Optional application role grants omit audit mutation, source deletion, TRUNCATE and schema ownership.
The trusted backend authenticates the caller, checks role/portfolio assignment and supplies processed_by.
Do not distribute database credentials to Analysts. Assignment views/functions are query helpers, not a claim of RLS.
A deployment requiring direct client database access must add and test RLS or dedicated secured API functions first.
