#!/usr/bin/env python3
"""Generate schema dictionary and Mermaid from the implemented SQL AST (pglast 7.7)."""
import json
from pathlib import Path
from pglast import parse_sql
from pglast.stream import RawStream

ROOT=Path(__file__).resolve().parents[1]
contract=json.loads((ROOT/'scripts/source_contract.json').read_text())
tables={}
def strings(nodes): return [n['sval'] for n in (nodes or [])]
def add_constraint(t,c,column=None):
    kind=c['contype']['name']
    cols=[column] if column else strings(c.get('keys') or c.get('fk_attrs'))
    if kind=='CONSTR_PRIMARY': t['pk']=cols
    if kind=='CONSTR_UNIQUE': t['unique'].append(cols)
    if kind=='CONSTR_FOREIGN':
        t['fks'].append({'columns':cols,'table':c['pktable']['relname'],'references':strings(c['pk_attrs'])})
    if kind=='CONSTR_NOTNULL' and column: t['columns'][column]['nullable']=False
    if kind=='CONSTR_IDENTITY' and column: t['columns'][column]['nullable']=False

for node in parse_sql((ROOT/'schema/02_create_tables.sql').read_text()):
    d=node.stmt()
    if d['@']!='CreateStmt': continue
    name=d['relation']['relname'];t={'columns':{},'pk':[],'unique':[],'fks':[]};tables[name]=t
    for el in d['tableElts']:
        if el['@']=='ColumnDef':
            col=el['colname'];typ='.'.join(strings(el['typeName']['names'])).replace('pg_catalog.','')
            typ={'int8':'bigint','int2':'smallint','timestamptz':'timestamp with time zone'}.get(typ,typ)
            t['columns'][col]={'type':typ,'nullable':True}
            for c in el.get('constraints') or []: add_constraint(t,c,col)
        elif el['@']=='Constraint': add_constraint(t,el)
for node in parse_sql((ROOT/'schema/03_constraints.sql').read_text()):
    d=node.stmt()
    if d['@']!='AlterTableStmt': continue
    t=tables[d['relation']['relname']]
    for cmd in d['cmds']:
        c=cmd.get('def')
        if c and c['@']=='Constraint': add_constraint(t,c)
for name,t in tables.items():
    for col in t['pk']: t['columns'][col]['nullable']=False
    for fk in t['fks']:
        if not fk['references']: fk['references']=tables[fk['table']]['pk']

D={
 'security_id':'Stable security identifier; symbol/name may change without changing this key.',
 'symbol':'Display trading symbol; source does not establish global symbol uniqueness.',
 'name':'Security display name.', 'type':'Instrument classification from D1.',
 'currency':'Currency of this record or monetary snapshot; three uppercase letters.',
 'underlying_security_id':'Underlying/reference security; also identifies spin-off parent in D1.',
 'portfolio_id':'Stable portfolio identifier.', 'portfolio_name':'Portfolio display name.',
 'client_id':'Source client identifier; no client master file was supplied.',
 'client_type':'Source client category.', 'base_currency':'Portfolio reporting currency.',
 'user_id':'Application/external identity key.', 'display_name':'Human-readable user name, not a credential.',
 'role':'ADMIN or ANALYST as required by specification.', 'auth_subject':'Unique external identity-provider subject; no passwords stored.',
 'is_active':'Whether backend may authorize this user.', 'created_at':'Record creation timestamp with time zone.',
 'qty':'Settled snapshot quantity; nonnegative for supplied long-only universe.',
 'avg_cost':'Snapshot unit cost; total basis should be preserved separately in processing.',
 'as_of_date':'Historical snapshot date; part of the natural key.', 'balance':'Cash balance, can be negative for an explicit overdraft policy.',
 'price_date':'Source price date; part of the natural key.', 'close_price':'Source mark; preserve even where source note says opening/fair value.',
 'note':'Source price note, preserved verbatim after explicit parsing recovery.',
 'ca_id':'Stable corporate-action event identifier.', 'action_type':'One of the 13 observed action types.',
 'tier':'Source hackathon complexity tier 1–3.', 'status':'Record lifecycle status; see design for table-specific allowed values.',
 'ex_date':'Source entitlement/effective date; operational semantics depend on action.',
 'record_date':'Source holder-confirmation date; nullable for name change.', 'pay_date':'Source payment/distribution date; nullable for name change.',
 'election_deadline':'Last permitted source election date (inclusive). No time zone/cutoff time supplied.',
 'ratio_numerator':'Positive numerator of source share ratio.', 'ratio_denominator':'Positive denominator of source share ratio.',
 'cash_rate_per_share':'Source stated cash rate; CA005 conflicts with notes and is gated.',
 'subscription_price':'Cash per exercised rights share.', 'offer_price':'Cash per accepted tender share.',
 'new_security_id':'Resulting/acquirer/child/underlying security.',
 'cost_basis_allocation_pct':'Percentage of original basis allocated to resulting security (0–100).',
 'tax_withholding_pct':'Withholding percentage (0–100), not a decimal fraction.', 'notes':'Source narrative preserved; not an executable rule.',
 'announcement_date':'Optional announcement date; none supplied, never synthesized.',
 'parent_ca_id':'Related dividend for DRIP; proposed CA010 → CA001 linkage.',
 'supersedes_ca_id':'Prior event corrected by a distinct new event ID.',
 'new_name':'Proposed effective name derived from source note, subject to review.',
 'new_symbol':'Proposed effective symbol derived from source note, subject to review.',
 'reinvestment_price':'Proposed DRIP price from source note, subject to review.',
 'tender_cap_pct':'Proposed cap from source note; final acceptance/proration still required.',
 'policy':'Reviewed eligibility, recognition, precision, fraction and accounting policy with provenance/version.',
 'processing_block_reason':'Nonempty reason prevents processing; empty requires reviewed_by, reviewed_at and policy.',
 'reviewed_by':'Application user who approved supplemental terms/policy.', 'reviewed_at':'Review timestamp.',
 'provenance':'Source/workbook reference for supplemental terms.',
 'election_id':'Stable election ID; processing FK also verifies action and portfolio.',
 'election_type':'SUBSCRIBE/LAPSE/SELL/TENDER/DRIP/CASH/CONVERT constrained by event type.',
 'elected_qty':'Instruction quantity; positive for exercise/sale/tender/conversion, zero for lapse, null for DRIP/cash.',
 'election_date':'Source date of instruction.',
 'processing_id':'Database-generated processing attempt identifier.',
 'processing_date':'Recorded processing timestamp, separate from economic effective date.',
 'effective_date':'Economic posting date selected by reviewed rules.',
 'rule_applied':'Human-readable calculation/validation rule reference.', 'rule_version':'Version identifier of service rule/policy.',
 'eligible_qty':'Eligibility snapshot quantity used by calculator.', 'eligibility_date':'Date used to establish eligible quantity.',
 'before_quantity':'Primary-security quantity before this adjustment.', 'after_quantity':'Primary-security quantity after this adjustment.',
 'before_avg_cost':'Primary-security unit cost before adjustment.', 'after_avg_cost':'Primary-security unit cost after adjustment.',
 'before_cost_basis':'Exact total basis before adjustment (authoritative over rounded unit costs).',
 'after_cost_basis':'Exact total basis after adjustment.', 'before_cash':'Cash before adjustment in currency.',
 'after_cash':'Cash after adjustment; must equal before_cash + cash_movement when supplied.',
 'cash_movement':'Signed cash change: positive inflow, negative outflow; audit rows are lifecycle descriptions, not an additive ledger.',
 'before_market_value':'Comparable marked value before adjustment; full multi-asset scope belongs in JSON.',
 'after_market_value':'Comparable marked value after adjustment.',
 'before_receivable_value':'Marked receivables/payables before adjustment; write explicit zero when none.',
 'after_receivable_value':'Marked receivables/payables after adjustment; null means unknown.',
 'reconciliation_difference':'Service-computed residual after explained movements/leakage.',
 'expected_leakage':'Explained tax, rounding, fees or other approved difference.',
 'before_state':'Complete versioned JSON object of affected book/reference state before the change.',
 'after_state':'Complete versioned JSON object of affected book/reference state after the change.',
 'error_reason':'Required human-readable reason for FAILED or REJECTED processing.',
 'processed_by':'Application user accountable for processing; backend authenticates it.',
 'reversal_of':'Link to original row in the same table; prevents duplicate processing/settlement reversal.',
 'reversal_reason':'Nonblank reason required for inverse processing.',
 'settlement_id':'Database-generated settlement-leg identifier.', 'leg_code':'Unique leg name within processing (e.g. GROSS, TAX, SHARES).',
 'settlement_type':'CASH or SECURITY; only matching movement is nonzero.',
 'quantity_movement':'Signed delivered/removed security quantity.',
 'recognition_date':'Date receivable/payable is recognized under approved policy.',
 'settlement_date':'Forecast or actual economic settlement date.', 'settled_at':'System confirmation timestamp; required iff SETTLED.',
 'cost_basis_movement':'Signed total basis delivered or removed by this leg.',
 'audit_id':'Database-generated append-only audit identifier.',
 'action':'Trigger-generated lifecycle action (PROCESSING_* / SETTLEMENT_* / REVERSAL).',
 'outcome':'Processing lifecycle outcome at audit time.',
 'performed_by':'Application processing actor; settlement lifecycle inherits its processing actor.',
 'occurred_at':'Database timestamp when audit record was emitted.',
 'reason':'Failure/rejection/reversal reason or settlement leg explanation.'}

lines=['# Data dictionary','', 'Generated from the implemented SQL AST. This is not a live database catalog assertion.',
 'All columns appear below. `finite_numeric` is an unconstrained PostgreSQL NUMERIC domain rejecting NaN and infinities.',
 'Composite keys/unique groups are identified as groups, not as individually unique columns. Identity keys are generated always.',
 'Additional CHECK/trigger rules are defined in schema/03_constraints.sql and DATABASE_DESIGN.md.','']
er=['# ER diagram','','Generated from implemented CREATE TABLE and ALTER TABLE foreign-key definitions.','', '```mermaid','erDiagram']
for name,t in tables.items():
    lines += [f'## {name}','',f"Primary key: `{', '.join(t['pk'])}`.",'', '| Column | Data type | Nullable | PK | FK | Unique | Description | Origin |','|---|---|---|---|---|---|---|---|']
    er.append(f'    {name} {{')
    for col,meta in t['columns'].items():
        pk=col in t['pk']; groups=[g for g in t['unique'] if col in g]
        fks=[f"{f['table']}({', '.join(f['references'])}) via ({', '.join(f['columns'])})" for f in t['fks'] if col in f['columns']]
        unique='; '.join('group ('+', '.join(g)+')' if len(g)>1 else 'Yes' for g in groups) or ('PK group' if pk else 'No')
        source='SOURCE DATA: '+contract[name]['filename'] if name in contract and col in contract[name]['headers'] else 'APPLICATION-GENERATED DATA'
        desc=D[col]
        if col=='reversal_of' and name=='audit_logs': desc='Original audit record linked by reversal processing; multiple lifecycle references allowed.'
        lines.append(f"| {col} | {meta['type']} | {'Yes' if meta['nullable'] else 'No'} | {'Yes' if pk else 'No'} | {'; '.join(fks) or '—'} | {unique} | {desc} | {source} |")
        keys=','.join((["PK"] if pk else [])+(["FK"] if fks else [])+(["UK"] if groups else []))
        er.append(f"        {meta['type'].replace(' ','_')} {col}"+(f' {keys}' if keys else ''))
    er.append('    }');lines.append('')
    for f in t['fks']:
        parent='o|' if any(t['columns'][c]['nullable'] for c in f['columns']) else '||'
        child='o|' if f['columns'] in t['unique'] or f['columns']==t['pk'] else 'o{'
        er.append(f"    {f['table']} {parent}--{child} {name} : \"{', '.join(f['columns'])}\"")
er+=['```','', 'Self-links preserve security lineage, event correction/DRIP relationships and immutable reversal history.']
(ROOT/'docs/DATA_DICTIONARY.md').write_text('\n'.join(lines)+'\n')
(ROOT/'docs/ER_DIAGRAM.md').write_text('\n'.join(er)+'\n')
(ROOT/'docs/schema_manifest.json').write_text(json.dumps(tables,indent=2)+'\n')

index_purposes={
 'one_original_processing':'Only one pending, successful or reversed original per action/portfolio; failed/rejected attempts remain retryable.',
 'positions_security_date':'Find affected portfolios at eligibility/reference dates.',
 'events_calendar':'Date calendar and status filtering.', 'events_security':'Security-to-event joins.',
 'events_action_status':'Action type/status filters.', 'events_record_date':'Record-date workload.',
 'events_pay_date':'Payment calendar.', 'events_election_deadline':'Upcoming election cutoff queues.',
 'elections_portfolio':'Portfolio elections without scanning action-first unique key.',
 'processing_portfolio_date':'Historical before/after portfolio reports.', 'processing_status':'Pending/failed operations queues.',
 'settlement_forecast':'Portfolio/date/status cash and security forecasts.', 'settlement_security':'Settlement security impact lookup.',
 'audit_portfolio_date':'Portfolio audit timeline.', 'audit_event':'Action-wide audit search.',
 'audit_processing':'Processing detail and inverse audit linkage.', 'audit_security':'Security audit history.',
 'assignments_portfolio':'Find assigned Analysts for a portfolio.'}
idx=['# Index rationale','','Primary and UNIQUE constraints automatically supply B-tree indexes. No duplicate indexes are created for their exact prefixes.',
 'Composite position/cash keys start with portfolio; price keys start with security/date; elections have action/portfolio and election-ID keys.',
 'Measure production EXPLAIN plans before adding broader JSON indexes or indexes for low-volume foreign keys.','', '| Index | Purpose |','|---|---|']
for n in parse_sql((ROOT/'schema/04_indexes.sql').read_text()):
    d=n.stmt()
    if d['@']=='IndexStmt': idx.append(f"| {d['idxname']} | {index_purposes[d['idxname']]} |")
(ROOT/'docs/INDEXES.md').write_text('\n'.join(idx)+'\n')
print(f'Documented {len(tables)} tables, {sum(len(t["columns"]) for t in tables.values())} columns and {sum(len(t["fks"]) for t in tables.values())} foreign keys.')
