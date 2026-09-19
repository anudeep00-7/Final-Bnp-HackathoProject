# Future backend integration

Use a server-side psycopg connection pool and environment-provided credentials. Parameterize values.
Use one transaction for each portfolio adjustment. The shipped layer is schema + import + validation + preview
calculators. It is not a complete posting service; do not claim that importing data processes its events.

1. Authenticate the request in the backend. Resolve `users.auth_subject`, reject inactive users. Only ADMIN
   posts; Analysts view assigned portfolios and submit elections. `can_view_portfolio` is a helper, not RLS.
2. Lock the event `FOR UPDATE`, then portfolio `FOR UPDATE`, consistently in that order. Check ACTIVE status,
   event_terms processing gate, prior processing, key dates and approved policy. Keep all writers on this protocol.
3. Read the latest historical position before the explicitly approved eligibility cutoff, with explicit handling
   of intervening trades and processing. Do not use today’s quantity automatically. Price lookups must select
   latest available price at/before the requested date; missing prices are errors, never zero.
4. Preview using Decimal. The included core calculator supports cash dividend, bonus, split/reverse split,
   name change and rights subscribe/lapse. Remaining actions need reviewed calculators. It requires eligible
   quantity to equal current quantity (bootstrap demonstration); extend explicitly for intervening trades.
5. Validate election holdings/entitlement, cash, deadline, acceptance/proration and fees in the service.
   The database enforces election type, quantity shape, deadline and relationship consistency, not dynamic entitlement.
6. Insert PENDING processing with rule/version/policy source, full before-state, eligibility date and quantity.
   Preserve the position and price dates used. Multi-asset JSON snapshots must enumerate every impacted security,
   currencies, quantities, exact total basis, unit cost, marks, receivable values and reference-data changes.
7. Recognize receivables/payables as PENDING settlements on the approved recognition date. At settlement,
   atomically post dated position/cash snapshots and update settlement status. Historical date keys permit one
   end-of-day snapshot per asset: same-day adjustments must use a locked update/upsert and preserve individual
   before/after versions in processing/audit. Never alter bootstrap history to represent a later event.
8. Persist gross cash, withholding, purchase, new shares and fractions as distinct leg_code rows. No payment leg
   for a name change. Store both source and child security positions/basis for merger, spin-off and conversion.
   `cost_basis_movement` is signed; cash and security legs are separate so forecasting avoids netting away tax.
9. Compare full portfolio marks + cash + receivables before/after using the same currency/date conventions.
   Explicitly distinguish price moves, tax leakage, subscription funding and rounding; do not assert neutrality
   for every action or hide discrepancies with a balancing entry.
10. Write after snapshots and summaries; transition to PROCESSED and commit. Audit rows are emitted automatically
    for processing and settlement changes. Audit `cash_movement` is descriptive per lifecycle record; sum actual
    SETTLED legs for cash reporting, never sum every audit row.
11. On error, rollback ALL book changes. In a fresh transaction, append FAILED or REJECTED processing with valid
    context, zero movement and a useful reason. Unknown source IDs belong in an external validation/request log.
    Retry serialization/deadlock failures with a bounded retry, but treat unique violations as duplicate requests.

## Reversal/correction

Schema links and exact-inverse structural checks are provided, but no end-to-end book reversal service is enabled.
A future implementation must lock event/portfolio and all affected rows; verify the current state still matches
original after_state; reject subsequent dependent adjustments (or unwind them in reverse order); restore exact
stored before_state rather than recalculate terms; insert inverse settlement legs linked by reversal_of; and
insert the linked inverse processing with a reason in the SAME transaction. The trigger marks the original
REVERSED. Never delete the original audit, processing, prices or settlement rows.

CA016 only establishes source status REVERSED. It does not authorize creating fabricated original adjustments.
Corrections should receive a new ca_id and `event_terms.supersedes_ca_id`, with reviewed terms.

## Minimal query examples

```sql
SELECT * FROM corporate_actions.current_positions WHERE portfolio_id = $1;
SELECT * FROM corporate_actions.settlement_forecast
 WHERE portfolio_id = $1 AND settlement_date BETWEEN $2 AND $3;
SELECT * FROM corporate_actions.audit_logs
 WHERE portfolio_id = $1 ORDER BY occurred_at, audit_id;
SELECT DISTINCT ON (security_id) security_id, close_price, price_date
 FROM corporate_actions.prices WHERE price_date <= $1
 ORDER BY security_id, price_date DESC;
```

Use psycopg `%s` placeholders in Python; `$1` above illustrates native prepared SQL parameters.
Source prices do not contain FX: reject mixed-currency portfolio totals unless an explicit FX service is added.

## Deployment hardening

Keep migration owner credentials out of the web process. Optional `scripts/grant_backend.sql` takes an existing
NOINHERIT application role and grants the required minimum table/sequence access, excluding audit writes,
TRUNCATE, source deletion and schema ownership. This trusted service role still has book write capability:
it must not be exposed to clients, and its API must enforce the transaction contract above. There is no RLS.
