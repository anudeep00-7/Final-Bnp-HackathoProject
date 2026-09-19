#!/usr/bin/env python3
"""Read-only validation. Default: strict CSV, no guessed repairs or source mutations."""
import argparse
import csv
from collections import Counter
from datetime import date
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import re
import sys

CONTRACT = json.loads(Path(__file__).with_name('source_contract.json').read_text())
ORDER = ['securities', 'portfolios', 'positions', 'cash_balances', 'prices', 'corporate_action_events', 'ca_elections']
ACTIONS = {'CASH_DIVIDEND','STOCK_SPLIT','BONUS_ISSUE','STOCK_DIVIDEND','MERGER','SPIN_OFF','DELISTING','RIGHTS_ISSUE','TENDER_OFFER','DRIP_ELECTION','CONVERSION','REVERSE_SPLIT','NAME_CHANGE'}
VOLUNTARY = {'RIGHTS_ISSUE': {'SUBSCRIBE','SELL','LAPSE'}, 'TENDER_OFFER': {'TENDER'}, 'DRIP_ELECTION': {'DRIP','CASH'}, 'CONVERSION': {'CONVERT'}}
RATIOS = {'STOCK_SPLIT','REVERSE_SPLIT','BONUS_ISSUE','STOCK_DIVIDEND','MERGER','SPIN_OFF','RIGHTS_ISSUE','CONVERSION'}
ENUMS = {
 ('securities','type'): {'EQUITY','CONVERTIBLE_BOND','PREFERENCE_SHARE'},
 ('securities','status'): {'ACTIVE','INACTIVE','DELISTED'},
 ('portfolios','client_type'): {'INDIVIDUAL','PENSION','FAMILY_OFFICE','MUTUAL_FUND','ENDOWMENT','PROP_DESK'},
 ('corporate_action_events','action_type'): ACTIONS,
 ('corporate_action_events','status'): {'ACTIVE','REVERSED','REJECTED','INCOMPLETE','CANCELLED'},
 ('ca_elections','status'): {'CONFIRMED'},
 ('ca_elections','election_type'): set.union(*VOLUNTARY.values()),
}


def scalar(text, kind):
    if text == '':
        return None
    if kind == 'text':
        return text
    if text != text.strip():
        raise ValueError('surrounding whitespace in typed field')
    if kind == 'date':
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', text):
            raise ValueError('expected ISO YYYY-MM-DD')
        return date.fromisoformat(text)
    if kind == 'integer':
        if not re.fullmatch(r'\d+', text):
            raise ValueError('expected integer')
        return int(text)
    if not re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)', text):
        raise ValueError('expected finite decimal without separators/exponent')
    value = Decimal(text)
    if not value.is_finite():
        raise ValueError('non-finite number')
    return value


def known_repair(table, row, line, digest):
    """Whitelist exact source versions/locations. Never heuristically shift arbitrary CSV cells."""
    if digest != CONTRACT[table]['sha256']:
        return None, None
    if table == 'prices' and line == 19 and len(row) == 5 and row[:2] == ['SEC005','2026-05-15']:
        return row[:3] + [','.join(row[3:])], 'Join comma-split final note; all typed fields unchanged'
    if table == 'corporate_action_events' and line == 15 and len(row) == 19 and row[0] == 'CA014':
        return row[:17] + [','.join(row[17:])], 'Join comma-split final notes; all typed fields unchanged'
    if table == 'corporate_action_events' and line == 11 and len(row) == 19 and row[0] == 'CA010' and row[15:18] == ['', '', '15']:
        return row[:16] + row[17:], 'Remove surplus empty cell at field 17; restore withholding 15 to field 17 and notes to field 18'
    return None, None


def semantic(table, r):
    errors = []
    for (t,c), values in ENUMS.items():
        if t == table and r[c] not in values:
            errors.append(f'{c}: unsupported value {r[c]!r}')
    for c,v in r.items():
        if c in ('currency','base_currency') and not re.fullmatch('[A-Z]{3}', v or ''):
            errors.append(f'{c}: expected three uppercase letters')
        if isinstance(v,Decimal) and c != 'balance' and v < 0:
            errors.append(f'{c}: negative value not allowed')
        if c.endswith('_pct') and v is not None and not 0 <= v <= 100:
            errors.append(f'{c}: expected 0..100')
    if table == 'securities' and r['security_id'] == r['underlying_security_id']:
        errors.append('security cannot underlie itself')
    if table == 'corporate_action_events':
        a = r['action_type']
        if r['tier'] not in (1,2,3): errors.append('tier must be 1..3')
        for c in ('record_date','pay_date'):
            if r[c] and r[c] < r['ex_date']: errors.append(f'{c} precedes ex_date')
        if r['record_date'] and r['pay_date'] and r['pay_date'] < r['record_date']: errors.append('pay_date precedes record_date')
        if r['election_deadline'] and r['pay_date'] and r['election_deadline'] > r['pay_date']: errors.append('deadline after pay_date')
        n,d = r['ratio_numerator'],r['ratio_denominator']
        if (n is None) != (d is None) or (n is not None and (n <= 0 or d <= 0)): errors.append('ratio needs two strictly positive values')
        if r['new_security_id'] == r['security_id']: errors.append('new security equals source')
        if r['status'] != 'INCOMPLETE':
            required = []
            if a != 'NAME_CHANGE': required += ['record_date','pay_date']
            if a in RATIOS: required += ['ratio_numerator','ratio_denominator']
            if a in VOLUNTARY: required += ['election_deadline']
            if a in {'CASH_DIVIDEND','DRIP_ELECTION','DELISTING'}: required += ['cash_rate_per_share']
            if a in {'MERGER','SPIN_OFF','CONVERSION'}: required += ['new_security_id']
            if a == 'RIGHTS_ISSUE': required += ['subscription_price']
            if a == 'TENDER_OFFER': required += ['offer_price']
            errors += [f'{c}: required for {a}' for c in required if r[c] is None]
    if table == 'ca_elections':
        t,q = r['election_type'],r['elected_qty']
        if t in {'SUBSCRIBE','SELL','TENDER','CONVERT'} and (q is None or q <= 0): errors.append('positive elected_qty required')
        if t == 'LAPSE' and q != 0: errors.append('LAPSE requires zero quantity')
        if t in {'DRIP','CASH'} and q is not None: errors.append('DRIP/CASH quantity must be empty')
    return errors


def validate(source_dir, repairs='none'):
    source_dir = Path(source_dir)
    report = {'mode':repairs,'files':{},'issues':[], 'valid_counts':{}, 'source_unchanged':True}
    data = {t:[] for t in ORDER}
    def issue(table,line,code,message,**more):
        report['issues'].append(dict(table=table,line=line,code=code,message=message,**more))
    for table in ORDER:
        spec = CONTRACT[table]
        path = source_dir / spec['filename']
        # Also accept canonical names without D-prefix, never ambiguous glob selection.
        if not path.exists(): path = source_dir / spec['filename'][3:]
        if not path.exists():
            issue(table,0,'ERROR','Required file missing: '+spec['filename']); continue
        raw = path.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        report['files'][table] = {'path':str(path),'sha256':digest,'source_rows':0}
        try:
            with path.open(encoding='utf-8-sig',newline='') as f:
                reader = csv.reader(f, strict=True)
                header = next(reader, None)
                if header != spec['headers']:
                    issue(table,1,'ERROR','Headers differ',expected=spec['headers'],actual=header); continue
                for row in reader:
                    line = reader.line_num
                    report['files'][table]['source_rows'] += 1
                    if len(row) != len(header):
                        fixed,reason = known_repair(table,row,line,digest) if repairs == 'known' else (None,None)
                        if fixed is None:
                            issue(table,line,'ERROR',f'Expected {len(header)} fields, found {len(row)}',raw_fields=row); continue
                        issue(table,line,'REPAIR',reason,raw_fields=row,parsed_fields=fixed)
                        row = fixed
                    values = {}
                    errors = []
                    for c,v in zip(header,row):
                        try:
                            values[c] = scalar(v,spec['types'][c])
                            if c in spec['required'] and (values[c] is None or isinstance(values[c],str) and not values[c].strip()):
                                errors.append(f'{c}: required value missing')
                        except (ValueError,InvalidOperation) as exc:
                            errors.append(f'{c}: {exc}')
                    if not errors: errors = semantic(table,values)
                    if errors:
                        issue(table,line,'ERROR','; '.join(errors),raw_fields=row)
                    else:
                        data[table].append((line,values))
        except (csv.Error,UnicodeError) as exc:
            issue(table,locals().get('reader').line_num if 'reader' in locals() else 0,'ERROR',f'Parsing stopped; remaining records not imported: {exc}')
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            report['source_unchanged'] = False
            issue(table,0,'ERROR','Source changed during validation')
        key_sets = [spec['pk']]
        if table == 'ca_elections': key_sets.append(['ca_id','portfolio_id'])
        for keys in key_sets:
            counts = Counter(tuple(r[k] for k in keys) for _,r in data[table])
            kept=[]
            for line,r in data[table]:
                key=tuple(r[k] for k in keys)
                if counts[key]>1: issue(table,line,'ERROR',f'Duplicate key {keys}: {key}; all colliding records quarantined')
                else: kept.append((line,r))
            data[table]=kept
    # Propagate rejected parents, including self-referencing security dependencies.
    changed=True
    while changed:
        changed=False
        ids={t:{r[CONTRACT[t]['pk'][0]] for _,r in data[t]} for t in ('securities','portfolios','corporate_action_events')}
        events={r['ca_id']:r for _,r in data['corporate_action_events']}
        for table in ORDER:
            kept=[]
            for line,r in data[table]:
                errors=[]
                for c,parent in [('security_id','securities'),('underlying_security_id','securities'),('new_security_id','securities'),('portfolio_id','portfolios'),('ca_id','corporate_action_events')]:
                    if c in r and r[c] is not None and not (table == parent and c == CONTRACT[table]['pk'][0]) and r[c] not in ids[parent]:
                        errors.append(f'{c}: missing or invalid parent {r[c]}')
                if table == 'ca_elections' and r['ca_id'] in events:
                    e=events[r['ca_id']]
                    if e['status']!='ACTIVE': errors.append('election event is not ACTIVE')
                    if r['election_type'] not in VOLUNTARY.get(e['action_type'],set()): errors.append('election incompatible with event')
                    if e['election_deadline'] is None or r['election_date']>e['election_deadline']: errors.append('election exceeds deadline')
                if errors:
                    issue(table,line,'ERROR','; '.join(errors)); changed=True
                else: kept.append((line,r))
            data[table]=kept
    for table in ORDER: report['valid_counts'][table]=len(data[table])
    report['error_count']=sum(x['code']=='ERROR' for x in report['issues'])
    report['repair_count']=sum(x['code']=='REPAIR' for x in report['issues'])
    report['business_warnings']=['All ACTIVE events require reviewed eligibility/recognition/rounding policy before processing.', 'CA005 cash terms conflict.', 'CA010 is linked to CA001, not a second dividend.', 'CA016 has no supplied original reversal history.', 'See docs/BUSINESS_RULES.md for price and policy ambiguities.']
    return {t:[r for _,r in rows] for t,rows in data.items()},report


def parser():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source-dir',required=True,type=Path)
    p.add_argument('--repairs',choices=['none','known'],default='none')
    p.add_argument('--report',type=Path,required=True)
    return p


def save_report(path,report):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(report,indent=2,default=str)+'\n')


if __name__=='__main__':
    args=parser().parse_args()
    _,report=validate(args.source_dir,args.repairs)
    save_report(args.report,report)
    print(json.dumps({k:report[k] for k in ('valid_counts','error_count','repair_count')}))
    sys.exit(1 if report['error_count'] else 0)
