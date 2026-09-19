#!/usr/bin/env python3
"""Execute SQL suite using DATABASE_URL, exiting nonzero on any failed assertion."""
import os
from pathlib import Path
import psycopg
with psycopg.connect(os.environ['DATABASE_URL'],autocommit=True) as conn:
    conn.add_notice_handler(lambda notice: print(notice.message_primary))
    conn.execute(Path(__file__).with_name('database_tests.sql').read_text())
print('SQL suite passed; all fixture writes rolled back.')
