#!/usr/bin/env python3
"""Install a fresh schema atomically; deliberately refuses an existing schema."""
import os
from pathlib import Path
import psycopg
root=Path(__file__).resolve().parents[1]
with psycopg.connect(os.environ['DATABASE_URL']) as conn:
    with conn.transaction():
        for p in sorted((root/'schema').glob('*.sql')):
            if p.name=='05_seed_users.sql': continue
            conn.execute(p.read_text())
print('Schema installed. Optional demo users are a separate explicit step.')
