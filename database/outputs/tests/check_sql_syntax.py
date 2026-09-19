#!/usr/bin/env python3
"""PostgreSQL 17 parser checks only; this does NOT execute SQL or prove trigger behavior."""
import json
from pathlib import Path
from pglast import parse_sql,parse_plpgsql,get_postgresql_version
ROOT=Path(__file__).resolve().parents[1]
results={'parser_postgresql_version':get_postgresql_version(),'runtime_execution':False,'files':[]}
for p in sorted((ROOT/'schema').glob('*.sql'))+[ROOT/'tests/database_tests.sql']:
    source=p.read_text(); tree=parse_sql(source); funcs=0
    for stmt in tree:
        n=stmt.stmt
        if type(n).__name__=='DoStmt' or type(n).__name__=='CreateFunctionStmt' and 'plpgsql' in str(n):
            start=stmt.stmt_location;end=start+stmt.stmt_len if stmt.stmt_len else len(source)
            parse_plpgsql(source[start:end]); funcs+=1
    results['files'].append({'file':str(p.relative_to(ROOT)),'statements_parsed':len(tree),'plpgsql_bodies_parsed':funcs})
print(json.dumps(results,indent=2))
