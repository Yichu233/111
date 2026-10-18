"""Paired positive/negative SQLite rules, restart persistence, controlled files."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from app import data, domain
from app.storage import Repository, StorageError


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'samples.sqlite3'
        self.repo = Repository(self.path)
        self.db = sqlite3.connect(self.path)
        self.db.execute('PRAGMA foreign_keys=ON')

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def rejects(self, sql, values=()):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sql, values)

    def test_all_seed_values_and_unknowns_survive_normalization(self):
        with self.repo.read() as store:
            self.assertEqual(store.users(), list(data.USERS.values()))
            self.assertEqual(store.terms(), data.TERMS)
            for original in data.OFFERINGS.values():
                stored = store.offering(original['id'])
                self.assertEqual(stored, {k:v for k,v in original.items() if k != 'teacher_ids'})
                self.assertEqual([t['id'] for t in store.teachers(original['id'])], original['teacher_ids'])
            for original in data.COURSES.values():
                self.assertEqual(store.course(original['id']), original)
            for original in data.RESOURCES.values():
                self.assertEqual(store.resource(original['id']), {k:v for k,v in original.items() if k != 'allowed_roles'})
                for role in ('teacher', 'director', 'supervisor'):
                    self.assertEqual(store.allows(original['id'], role), role in original['allowed_roles'])
            for original in data.RECORDS.values():
                self.assertEqual(store.record(original['id']), original)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])
        self.assertEqual(len(self.db.execute("SELECT name FROM sqlite_schema WHERE type='table'").fetchall()), 8)

    def test_restart_preserves_changed_text_without_reseed(self):
        self.db.execute("UPDATE course SET description='保留已有资料' WHERE id='C01'")
        self.db.commit()
        restarted = Repository(self.path)
        with restarted.read() as store:
            user = store.user('teacher-a')
            result = domain.offering_view(store, domain.offering_for(store, user, 'K01'))
            self.assertEqual(result['course']['description'], '保留已有资料')

    def test_unknown_version_is_rejected_without_modifying_file(self):
        self.db.execute('PRAGMA user_version=55'); self.db.commit()
        before = self.path.read_bytes()
        with self.assertRaisesRegex(StorageError, 'Unsupported schema version'):
            Repository(self.path)
        self.assertEqual(self.path.read_bytes(), before)

    def test_changed_schema_is_rejected_without_silent_repair(self):
        self.db.execute('DROP TRIGGER app_user_teacher_update'); self.db.commit()
        before = self.path.read_bytes()
        with self.assertRaisesRegex(StorageError, 'Unsupported schema structure'):
            Repository(self.path)
        self.assertEqual(self.path.read_bytes(), before)

    def test_existing_empty_or_corrupt_database_is_not_seeded(self):
        for content in (b'', b'not a sqlite database'):
            target = Path(self.temp.name) / 'existing.sqlite3'
            target.write_bytes(content)
            with self.assertRaises(StorageError):
                Repository(target)
            self.assertEqual(target.read_bytes(), content)

    def test_read_connection_is_read_only_and_foreign_keys_are_enabled(self):
        with self.repo.read() as store:
            self.assertEqual(store.connection.execute('PRAGMA foreign_keys').fetchone()[0], 1)
            with self.assertRaises(sqlite3.OperationalError):
                store.connection.execute("UPDATE course SET name='mutated'")

    def test_two_initializers_publish_one_complete_database(self):
        path = Path(self.temp.name) / 'concurrent.sqlite3'
        with ThreadPoolExecutor(max_workers=2) as executor:
            repos = list(executor.map(Repository, [path, path]))
        for repo in repos:
            with repo.read() as store:
                self.assertEqual(len(store.users()), 5)
        self.assertFalse(list(path.parent.glob('.aijiaoxue-*')))

    def test_cross_course_resource_rejected_shared_and_matching_accepted(self):
        sql = 'INSERT INTO resource VALUES (?,?,?,?,?,?,?)'
        self.rejects(sql, ('bad','C02','K01','Title','Description',None,None))
        self.db.execute(sql, ('shared','C02',None,'Title','Description',None,None))
        self.db.execute(sql, ('specific','C02','K03','Title','Description',None,None))
        self.rejects("UPDATE resource SET course_id='C02' WHERE id='R02'")
        self.db.execute("UPDATE resource SET offering_id='K02' WHERE id='R02'")

    def test_orphan_resource_rejected_even_when_shared(self):
        self.rejects("INSERT INTO resource VALUES ('bad','missing',NULL,'T','D',NULL,NULL)")
        self.db.execute("INSERT INTO resource VALUES ('ok','C01',NULL,'T','D',NULL,NULL)")

    def test_orphan_offering_course_and_term_rejected(self):
        sql = "INSERT INTO offering VALUES ('new',?,?,'class','schedule','room','unknown')"
        self.rejects(sql, ('missing','2026-fall'))
        self.rejects(sql, ('C01','missing'))
        self.db.execute(sql, ('C01','2026-fall'))

    def test_assignment_requires_teacher_on_insert_update_and_role_change(self):
        self.rejects("INSERT INTO teaching_assignment VALUES ('K02','director')")
        self.db.execute("INSERT INTO teaching_assignment VALUES ('K02','teacher-b')")
        self.rejects("UPDATE teaching_assignment SET user_id='supervisor' WHERE offering_id='K02' AND user_id='teacher-b'")
        self.db.execute("UPDATE teaching_assignment SET user_id='teacher-empty' WHERE offering_id='K02' AND user_id='teacher-b'")
        self.rejects("UPDATE app_user SET role='director' WHERE id='teacher-a'")
        self.db.execute("UPDATE app_user SET role='supervisor' WHERE id='director'")

    def test_assignment_unique_and_orphan_rules(self):
        self.rejects("INSERT INTO teaching_assignment VALUES ('K01','teacher-a')")
        self.rejects("INSERT INTO teaching_assignment VALUES ('missing','teacher-a')")
        self.rejects("INSERT INTO teaching_assignment VALUES ('K01','missing')")
        self.db.execute("INSERT INTO teaching_assignment VALUES ('K02','teacher-b')")

    def test_resource_role_unique_allowed_set_and_parent(self):
        self.rejects("INSERT INTO resource_role VALUES ('R01','teacher')")
        self.rejects("INSERT INTO resource_role VALUES ('R06','admin')")
        self.rejects("INSERT INTO resource_role VALUES ('missing','teacher')")
        self.db.execute("INSERT INTO resource_role VALUES ('R06','teacher')")

    def test_record_parent_and_primary_key(self):
        sql = "INSERT INTO supervision_record VALUES (?,?,'2026-09-01','observer','summary','source','source.txt')"
        self.rejects(sql, ('D01','K02'))
        self.rejects(sql, ('new','missing'))
        self.db.execute(sql, ('new','K02'))

    def test_role_credit_null_type_and_delete_constraints(self):
        self.rejects("INSERT INTO app_user VALUES ('bad','name','admin','dept')")
        self.db.execute("INSERT INTO app_user VALUES ('good','name','teacher','dept')")
        self.rejects("UPDATE course SET credits=-1 WHERE id='C01'")
        self.rejects("UPDATE course SET credits='unknown' WHERE id='C01'")
        self.rejects("UPDATE course SET id=NULL WHERE id='C01'")
        self.db.execute("UPDATE course SET credits=0 WHERE id='C01'")
        self.rejects("DELETE FROM course WHERE id='C01'")
        self.db.execute("INSERT INTO course VALUES ('unused','CS000','N','D',0,NULL)")
        self.db.execute("DELETE FROM course WHERE id='unused'")

    def test_controlled_file_paths_and_permission_before_existence(self):
        for filename in ('../data.py', str(self.path), 'missing-slides.txt'):
            self.db.execute('UPDATE resource SET file=? WHERE id=?', (filename, 'R06')); self.db.commit()
            with self.repo.read() as store:
                resource = store.resource('R06')
                self.assertEqual(domain.resource_state(store, store.user('teacher-a'), resource)[0], 'forbidden')
                self.assertEqual(domain.resource_state(store, store.user('director'), resource)[0], 'broken')

    def test_missing_record_source_and_file_read_failure_are_expected_errors(self):
        self.db.execute("UPDATE supervision_record SET source_file='../data.py' WHERE id='D01'"); self.db.commit()
        with self.repo.read() as store:
            with self.assertRaises(domain.APIError) as result:
                domain.record_source(store, store.user('supervisor'), 'D01', 'K01')
            self.assertEqual((result.exception.status, result.exception.code), (404, 'source_unavailable'))
            with patch.object(Path, 'read_bytes', side_effect=PermissionError('unreadable')):
                with self.assertRaises(domain.APIError) as result:
                    domain.resource_content(store, store.user('teacher-a'), 'R01', 'K01')
                self.assertEqual(result.exception.code, 'broken')

    def test_deleted_session_user_is_detected_by_repository(self):
        self.db.execute("DELETE FROM app_user WHERE id='teacher-empty'"); self.db.commit()
        with self.repo.read() as store:
            self.assertIsNone(store.user('teacher-empty'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
