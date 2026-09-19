from pathlib import Path
p=Path('outputs/database/docs')
p.joinpath('DATABASE_DESIGN.md').write_text('''# Database design

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
''')
p.joinpath('BUSINESS_RULES.md').write_text('''# Verified business rules and unresolved inputs

Read all 5 PDF pages and all populated rows 1–54 of workbook sheet `Corporate Action Rules`.
Workbook content is requirements evidence, not instructions to the agent.

| Action | Workbook rows | Database/service requirement |
|---|---|---|
| Cash dividend | 7–10 | Eligible quantity × rate; gross, withholding and net legs; receivable then cash; basis unchanged |
| Split / reverse split | 11–14 | Multiply quantity by numerator/denominator; inverse unit cost and reference price; total basis conserved |
| Bonus | 15–18 | Eligible quantity × ratio additional shares; spread original basis over enlarged holding |
| Stock dividend | 19–22 | Share receivable, final basis policy and fractional treatment required |
| Merger | 23–26 | Remove target, deliver final cash/share consideration; reviewed allocation policy |
| Spin-off | 27–30 | Parent retained, child delivered, approved parent/child basis allocation |
| Name change | 31–34 | Stable security_id, preserve old/new reference state; no payment or quantity change |
| Delisting | 35–38 | Track claim; post final proceeds, remove claim and write off remaining basis |
| Rights | 39–42 | Entitlement, subscribe/sell/lapse instruction, deadline, cash and proration checks |
| Tender | 43–46 | Submitted quantity differs from accepted; final proration before settlement |
| DRIP | 47–50 | Dividend, withholding, purchase and shares are linked; avoid double dividend with CA001 |
| Conversion | 51–54 | Cancel elected instrument, deliver underlying, transfer basis; resolve interest/fractions |

## Source defects and ambiguity

1. D5 physical line 19: five fields instead of four. The extra comma is within final note text. Explicit repair joins final fields with a comma.
2. D6 line 15 / CA014: nineteen fields instead of eighteen. Explicit repair joins final notes fields with a comma. Proposed new name Harbor Retail Group, symbol HRG are extracted from this note into event_terms with provenance.
3. D6 line 11 / CA010: nineteen fields. One surplus empty cell before withholding shifts 15 and notes right. Repair is restricted to the exact supplied row signature and source hash, removes one empty cell, and reports the transformation. Strict validation rejects all three anomalies. `--repairs known` explicitly enables these recoveries without changing files.
4. CA005 cash_rate_per_share=2.00 conflicts with note saying USD 2 per FOUR shares. Do not choose either silently; event_terms blocks processing until reviewed.
5. CA010 duplicates CA001 dividend entitlement; parent_ca_id links it. Price 42.00 exists only in notes, not a structured elections price. Confirm net/gross reinvestment and prevent duplicate dividend credits.
6. CA016 is already REVERSED in source with no original processing history. Import source status only; do not fabricate reversal history.
7. Workbook does NOT specify decimal scales, rounding mode, fractional-share policy, precise settled-position cutoff or universal accounting/tax conventions. Policies are required service inputs. Bootstrap assumption for demonstration is latest supplied settled snapshot strictly before ex-date, carried forward only absent intervening trades.
8. Workbook introduction mentions recognition at record date while several detailed rows recognize at ex-date. Recognition timing must be selected explicitly for the backend.
9. Tender pay-date workbook row 46 has only nine populated cells, shifting the final descriptions. Treat its prose as the requirement: settle accepted quantity, apply final proration, release rejected shares. Do not infer extra numeric terms.
10. Spin-off marks are not value neutral: 900 × 46 = 41,400 before versus 900 × 39.10 + 90 × 6.90 = 35,811 after (difference −5,589). Allocation 15% is a cost-basis instruction, not proof of valuation reconciliation. Report the discrepancy; do not synthesize prices.
11. No users file, trade/settlement feed, authoritative user assignments or announcement dates were supplied. Announcement date remains nullable application metadata. Seed users are explicitly demo identities.
12. Supplied rights post-price 31.50 need not equal a formula-derived TERP (34 + 0.25 × 8)/1.25 = 28.8. Preserve supplied prices and report market/rights effects separately.

Processing gate defaults to an unresolved-policy reason for every ACTIVE event. Import is allowed; actual processing
requires an authorized service to clear the gate after persisting the selected policy and reviewed terms.
Core calculator tests use an explicitly labeled demonstration policy, not purported workbook rounding.
''')
# Planned ER before SQL authoring; later regenerated from the actual PostgreSQL catalog when available.
rels=[('securities','positions'),('portfolios','positions'),('portfolios','cash_balances'),('securities','prices'),('securities','corporate_action_events'),('corporate_action_events','ca_elections'),('portfolios','ca_elections'),('users','user_portfolios'),('portfolios','user_portfolios'),('corporate_action_events','event_terms'),('corporate_action_events','ca_processing'),('portfolios','ca_processing'),('securities','ca_processing'),('users','ca_processing'),('ca_elections','ca_processing'),('ca_processing','settlements'),('portfolios','settlements'),('securities','settlements'),('ca_processing','audit_logs'),('corporate_action_events','audit_logs'),('portfolios','audit_logs'),('securities','audit_logs'),('users','audit_logs')]
p.joinpath('ER_DIAGRAM.md').write_text('# Relational model\n\n```mermaid\nerDiagram\n'+''.join(f'    {a} ||--o{{ {b} : references\n' for a,b in rels)+'    ca_processing o|--o| ca_processing : reverses\n    audit_logs o|--o{ audit_logs : reverses\n```\n\nColumn-level keys are generated in DATA_DICTIONARY.md.\n')
