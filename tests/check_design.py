"""Portable SQLite design audit; no external DB client or original workspace needed."""
from datetime import datetime, timezone
from pathlib import Path
import json
import re
import sqlite3
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.storage import Repository


def audit():
    design = ROOT / 'workspace' / 'aijiaoxue'
    assert (ROOT / 'app/schema.sql').read_bytes() == (design / '04-schema.sql').read_bytes(), 'DDL copies differ'
    requirements = set(re.findall(r'DR-\d{3}', (design / '01-data-requirements.md').read_text(encoding='utf-8-sig')))
    matrix = (design / '05-traceability-matrix.md').read_text(encoding='utf-8-sig')
    mapped = set(re.findall(r'^\|\s*(DR-\d{3})\s*\|', matrix, re.M))
    assert requirements == mapped, f'Missing/extra requirements: {requirements ^ mapped}'
    dictionary = (design / '03-data-dictionary.md').read_text(encoding='utf-8-sig')
    documented = set(re.findall(r'^\|([a-z_]+)\|([a-z_]+)\|', dictionary, re.M))
    assert 'DB (planned)' not in (design / '03-logical-schema.md').read_text(encoding='utf-8-sig'), 'Unverified DB claim'
    with tempfile.TemporaryDirectory() as directory:
        repo = Repository(Path(directory) / 'audit.sqlite3')
        connection = sqlite3.connect(repo.path)
        try:
            connection.execute('PRAGMA foreign_keys=ON')
            tables = [row[0] for row in connection.execute("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name")]
            actual = {(table, row[1]) for table in tables for row in connection.execute(f'PRAGMA table_info({table})')}
            assert actual == documented, f'Dictionary mismatch: {actual ^ documented}'
            checks = []
            expected = label = None
            statement = ''
            for line in (design / '05-assertions.sql').read_text(encoding='utf-8-sig').splitlines():
                if line.startswith('-- accept:') or line.startswith('-- reject:'):
                    expected, label = line[3:].split(':', 1)
                    continue
                if not line.strip() or line.startswith('--'):
                    continue
                statement += line + '\n'
                if not sqlite3.complete_statement(statement):
                    continue
                assert expected in ('accept', 'reject'), 'SQL assertion lacks expectation'
                connection.execute('SAVEPOINT assertion')
                rejected = False
                try:
                    connection.execute(statement)
                except sqlite3.IntegrityError:
                    rejected = True
                finally:
                    connection.execute('ROLLBACK TO assertion')
                    connection.execute('RELEASE assertion')
                assert rejected == (expected == 'reject'), f'{expected} failed: {label}: {statement}'
                checks.append({'expected':expected,'rule':label.strip(),'passed':True})
                expected = label = None; statement = ''
            assert not statement, 'Incomplete SQL assertion'
            counts = dict(connection.execute("SELECT type,count(*) FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' GROUP BY type"))
            plans = {}
            queries = {
                'term': "SELECT id FROM offering WHERE term_id='2026-fall' ORDER BY id",
                'teacher': "SELECT offering_id FROM teaching_assignment WHERE user_id='teacher-a'",
                'resources': "SELECT id FROM resource WHERE course_id='C01' AND (offering_id IS NULL OR offering_id='K01') ORDER BY id",
                'records': "SELECT id FROM supervision_record WHERE offering_id='K01' ORDER BY date,id",
            }
            for name, sql in queries.items():
                plans[name] = [row[3] for row in connection.execute('EXPLAIN QUERY PLAN ' + sql)]
            return {'executed_at':datetime.now(timezone.utc).isoformat(),'sqlite':sqlite3.sqlite_version,
                    'requirements':len(requirements),'tables':len(tables),'columns':len(actual),
                    'objects':counts,'assertions':checks,'passed':len(checks),'query_plans_on_sample':plans,
                    'dictionary_exact':True,'ddl_copies_exact':True,'traceability_complete':True}
        finally:
            connection.close()


if __name__ == '__main__':
    print(json.dumps(audit(), ensure_ascii=False, indent=2))
