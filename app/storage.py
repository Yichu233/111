"""SQLite sample storage: seed once atomically; never repair/reset an existing DB."""
from contextlib import contextmanager
from datetime import date
from pathlib import Path
import sqlite3

from . import data

SCHEMA = Path(__file__).with_name('schema.sql')
DEFAULT_DATABASE = Path(__file__).resolve().parent.parent / 'var' / 'aijiaoxue.sqlite3'
SCHEMA_VERSION = 1


class StorageError(RuntimeError):
    pass


def schema_signature(connection):
    return connection.execute("SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").fetchall()


class Repository:
    def __init__(self, path=DEFAULT_DATABASE, fixture_dir=data.DATA_DIR):
        self.path = Path(path).resolve()
        self.fixture_dir = Path(fixture_dir).resolve()
        if sqlite3.sqlite_version_info < (3, 37):
            raise StorageError('SQLite 3.37 or newer is required; database was not changed.')
        existed = self.path.exists()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            # Existing files are opened read-only: validation never changes their bytes.
            if existed:
                with self.read() as store:
                    self._validate(store.connection)
            else:
                self._initialize()
        except (sqlite3.Error, OSError) as error:
            raise StorageError(f'Database unavailable ({self.path}); no automatic reset: {error}') from error

    def _validate(self, connection):
        version = connection.execute('PRAGMA user_version').fetchone()[0]
        if version != SCHEMA_VERSION:
            raise StorageError(f'Unsupported schema version {version}; expected {SCHEMA_VERSION}. Database not reset.')
        with sqlite3.connect(':memory:') as expected:
            expected.executescript(SCHEMA.read_text(encoding='utf-8'))
            actual = [tuple(row) for row in schema_signature(connection)]
            if actual != schema_signature(expected):
                raise StorageError('Unsupported schema structure; database not reset.')
        if connection.execute('PRAGMA quick_check').fetchone()[0] != 'ok' or connection.execute('PRAGMA foreign_key_check').fetchall():
            raise StorageError('Database integrity check failed; database not reset.')
        if connection.execute("SELECT 1 FROM teaching_assignment a JOIN app_user u ON u.id=a.user_id WHERE u.role<>'teacher' LIMIT 1").fetchone():
            raise StorageError('Invalid teacher assignment; database not reset.')

    def _initialize(self):
        # Build privately and publish a complete DB with an exclusive hard link.
        # Two first starts can race; the losing initializer only validates the winner.
        import os
        import tempfile
        fd, name = tempfile.mkstemp(prefix='.aijiaoxue-', suffix='.sqlite3', dir=self.path.parent)
        os.close(fd)
        staging = Path(name)
        try:
            connection = sqlite3.connect(staging)
            try:
                connection.execute('PRAGMA foreign_keys=ON')
                connection.executescript('BEGIN IMMEDIATE;\n' + SCHEMA.read_text(encoding='utf-8'))
                self._seed(connection)
                connection.commit()
                self._validate(connection)
            finally:
                connection.close()
            try:
                os.link(staging, self.path)
            except FileExistsError:
                with self.read() as store:
                    self._validate(store.connection)
        finally:
            staging.unlink(missing_ok=True)

    @staticmethod
    def _seed(connection):
        def insert(table, values):
            for item in values:
                columns = ','.join(item)
                placeholders = ','.join('?' for _ in item)
                connection.execute(f'INSERT INTO {table} ({columns}) VALUES ({placeholders})', tuple(item.values()))
        insert('term', data.TERMS)
        insert('app_user', data.USERS.values())
        insert('course', data.COURSES.values())
        insert('offering', ({k: v for k, v in item.items() if k != 'teacher_ids'} for item in data.OFFERINGS.values()))
        insert('teaching_assignment', ({'offering_id': o['id'], 'user_id': user} for o in data.OFFERINGS.values() for user in o['teacher_ids']))
        insert('resource', ({k: v for k, v in item.items() if k != 'allowed_roles'} for item in data.RESOURCES.values()))
        insert('resource_role', ({'resource_id': r['id'], 'role': role} for r in data.RESOURCES.values() for role in r['allowed_roles']))
        for record in data.RECORDS.values():
            date.fromisoformat(record['date'])
        insert('supervision_record', data.RECORDS.values())

    @contextmanager
    def read(self):
        connection = sqlite3.connect(self.path.as_uri() + '?mode=ro', uri=True, timeout=5)
        connection.row_factory = sqlite3.Row
        try:
            connection.execute('PRAGMA foreign_keys=ON')
            connection.execute('PRAGMA query_only=ON')
            connection.execute('BEGIN')
            yield Store(connection, self.fixture_dir)
        finally:
            connection.close()


class Store:
    def __init__(self, connection, fixture_dir):
        self.connection, self.fixture_dir = connection, fixture_dir

    def rows(self, sql, args=()):
        return [dict(row) for row in self.connection.execute(sql, args)]

    def one(self, sql, args=()):
        row = self.connection.execute(sql, args).fetchone()
        return dict(row) if row else None

    def users(self):
        return self.rows('SELECT * FROM app_user ORDER BY rowid')

    def user(self, user_id):
        return self.one('SELECT * FROM app_user WHERE id=?', (user_id,))

    def terms(self):
        return self.rows('SELECT * FROM term ORDER BY rowid')

    def offering(self, offering_id):
        return self.one('SELECT * FROM offering WHERE id=?', (offering_id,))

    def course(self, course_id):
        return self.one('SELECT * FROM course WHERE id=?', (course_id,))

    def teachers(self, offering_id):
        return self.rows('SELECT u.* FROM teaching_assignment a JOIN app_user u ON a.user_id=u.id WHERE a.offering_id=? ORDER BY u.id', (offering_id,))

    def can_view(self, user, offering):
        if user['role'] == 'teacher':
            return bool(self.one('SELECT 1 FROM teaching_assignment WHERE offering_id=? AND user_id=?', (offering['id'], user['id'])))
        return user['role'] in ('director', 'supervisor') and self.course(offering['course_id'])['department'] == user['department']

    def offerings(self, user, term_id):
        return self.rows('''SELECT o.* FROM offering o JOIN course c ON c.id=o.course_id
            WHERE o.term_id=? AND ((?='teacher' AND EXISTS(SELECT 1 FROM teaching_assignment a WHERE a.offering_id=o.id AND a.user_id=?))
            OR (? IN ('director','supervisor') AND c.department=?)) ORDER BY o.id''',
            (term_id, user['role'], user['id'], user['role'], user['department']))

    def resources(self, offering):
        return self.rows('SELECT * FROM resource WHERE course_id=? AND (offering_id IS NULL OR offering_id=?) ORDER BY id', (offering['course_id'], offering['id']))

    def resource(self, resource_id):
        return self.one('SELECT * FROM resource WHERE id=?', (resource_id,))

    def allows(self, resource_id, role):
        return bool(self.one('SELECT 1 FROM resource_role WHERE resource_id=? AND role=?', (resource_id, role)))

    def records(self, offering_id):
        return self.rows('SELECT * FROM supervision_record WHERE offering_id=? ORDER BY date,id', (offering_id,))

    def record(self, record_id):
        return self.one('SELECT * FROM supervision_record WHERE id=?', (record_id,))
