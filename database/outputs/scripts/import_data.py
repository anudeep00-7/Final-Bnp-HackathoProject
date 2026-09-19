#!/usr/bin/env python3
"""Validate first, then import a complete source batch in one PostgreSQL transaction."""
import os
import sys
from pathlib import Path
import psycopg
from psycopg import sql
from validate_csvs import CONTRACT,ORDER,parser,validate,save_report


def import_batch(conn,data):
    with conn.transaction():
        if conn.info.dbname != 'corporate_actions_db' or not 170000 <= conn.info.server_version < 180000:
            raise ValueError('Requires corporate_actions_db on PostgreSQL 17')
        conn.execute('SELECT pg_advisory_xact_lock(7400217)')
        # Keep self-FKs valid even when the supplied security rows are reordered.
        remaining=list(data['securities']); inserted=set()
        ordered=[]
        while remaining:
            ready=[r for r in remaining if r['underlying_security_id'] is None or r['underlying_security_id'] in inserted]
            if not ready: raise ValueError('Cyclic or missing underlying security relationship')
            for r in ready:
                ordered.append(r);inserted.add(r['security_id']);remaining.remove(r)
        for table in ORDER:
            rows=ordered if table=='securities' else data[table]
            cols=CONTRACT[table]['headers']
            query=sql.SQL('INSERT INTO {}.{} ({}) VALUES ({})').format(sql.Identifier('corporate_actions'),sql.Identifier(table),sql.SQL(',').join(map(sql.Identifier,cols)),sql.SQL(',').join(sql.Placeholder() for _ in cols))
            with conn.cursor() as cur:
                cur.executemany(query,[[r[c] for c in cols] for r in rows])
        # Populate justified application metadata; retain provenance and processing gates.
        for e in data['corporate_action_events']:
            ca=e['ca_id']; note=e['notes'] or ''
            block='Eligibility, recognition and rounding policy require review'
            if ca=='CA005': block='Conflicting cash terms: structured rate 2.00 per share versus note 2.00 per four shares'
            if ca=='CA010': block='Confirm linked dividend, reinvestment cash basis, fractions and rounding'
            conn.execute('''INSERT INTO corporate_actions.event_terms
                (ca_id,parent_ca_id,new_name,new_symbol,reinvestment_price,tender_cap_pct,processing_block_reason,provenance)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)''',
                (ca,'CA001' if ca=='CA010' and any(x['ca_id']=='CA001' for x in data['corporate_action_events']) else None,
                 'Harbor Retail Group' if ca=='CA014' and 'Harbor Retail Group' in note else None,
                 'HRG' if ca=='CA014' and 'HBR to HRG' in note else None,
                 '42.00' if ca=='CA010' and '42.00' in note else None,
                 '30' if ca=='CA009' and '30 pct' in note else None,
                 block,'D6 notes (proposed terms, not approved); Corporate Action Rules workbook and docs/BUSINESS_RULES.md'))


def main():
    p=parser()
    p.add_argument('--allow-partial',action='store_true',help='Explicitly import only validated rows and quarantine all reported errors')
    args=p.parse_args()
    data,report=validate(args.source_dir,args.repairs)
    report['import_status']='NOT_STARTED'
    save_report(args.report,report)
    if report['error_count'] and not args.allow_partial:
        print('Validation errors: no database writes. See report.',file=sys.stderr);return 1
    if not report['source_unchanged']:
        print('Source changed: refusing import.',file=sys.stderr);return 1
    if not os.environ.get('DATABASE_URL'):
        print('Set DATABASE_URL (never pass credentials on command line).',file=sys.stderr);return 1
    connected=False
    try:
        with psycopg.connect(os.environ['DATABASE_URL']) as conn:
            connected=True
            import_batch(conn,data)
        report['import_status']='COMMITTED_PARTIAL' if report['error_count'] else 'COMMITTED'
        report['imported_counts']={t:len(data[t]) for t in ORDER}
    except (psycopg.Error,ValueError) as exc:
        report['import_status']='ROLLED_BACK' if connected else 'NOT_CONNECTED'
        # Deliberately avoid recording the connection string/credentials.
        report['database_error']=exc.diag.message_primary if isinstance(exc,psycopg.Error) and exc.diag.message_primary else str(exc) if isinstance(exc,ValueError) else type(exc).__name__
        save_report(args.report,report)
        print('Import failed; '+('transaction rolled back' if connected else 'no connection or writes')+'. See report.',file=sys.stderr);return 1
    save_report(args.report,report)
    print(report['import_status'],report['imported_counts']);return 0


if __name__=='__main__': sys.exit(main())
