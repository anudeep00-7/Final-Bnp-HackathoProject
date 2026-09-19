# Verified business rules and unresolved inputs

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
