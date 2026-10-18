-- SQLite paired rule assertions. Each statement runs in a savepoint against seeded data.
-- Runner: python tests/check_design.py (a fresh temporary database is created).
-- reject: BR-002 cross-course scoped resource
INSERT INTO resource VALUES ('assert_bad','C02','K01','T','D',NULL,NULL);
-- accept: BR-002 valid adjacent scoped resource
INSERT INTO resource VALUES ('assert_good','C02','K03','T','D',NULL,NULL);
-- accept: BR-002 course-shared resource
INSERT INTO resource VALUES ('assert_shared','C02',NULL,'T','D',NULL,NULL);
-- reject: BR-008 course-shared resource must still have a real course
INSERT INTO resource VALUES ('assert_orphan','missing',NULL,'T','D',NULL,NULL);
-- reject: BR-002 resource scope update cannot cross course
UPDATE resource SET offering_id='K03' WHERE id='R02';
-- accept: BR-002 resource scope update within same course
UPDATE resource SET offering_id='K02' WHERE id='R02';
-- reject: BR-008 duplicate assignment
INSERT INTO teaching_assignment VALUES ('K01','teacher-a');
-- accept: BR-008 distinct teacher can join the same opening
INSERT INTO teaching_assignment VALUES ('K02','teacher-b');
-- reject: RL-002 director cannot teach
INSERT INTO teaching_assignment VALUES ('K02','director');
-- accept: RL-002 unassigned teacher can teach
INSERT INTO teaching_assignment VALUES ('K02','teacher-empty');
-- reject: RL-002 assignment update cannot choose a non-teacher
UPDATE teaching_assignment SET user_id='director' WHERE offering_id='K02';
-- accept: RL-002 assignment update can choose another teacher
UPDATE teaching_assignment SET user_id='teacher-b' WHERE offering_id='K02';
-- reject: RL-002 assigned teacher cannot become a director
UPDATE app_user SET role='director' WHERE id='teacher-a';
-- accept: RL-002 unassigned teacher can change role
UPDATE app_user SET role='director' WHERE id='teacher-empty';
-- reject: BR-008 orphan assignment
INSERT INTO teaching_assignment VALUES ('missing','teacher-a');
-- accept: BR-008 real opening assignment
INSERT INTO teaching_assignment VALUES ('K04','teacher-a');
-- reject: BR-008 duplicate resource role
INSERT INTO resource_role VALUES ('R01','teacher');
-- accept: BR-008 another role on a real resource
INSERT INTO resource_role VALUES ('R06','teacher');
-- reject: BR-008 orphan resource role
INSERT INTO resource_role VALUES ('missing','teacher');
-- reject: BR-008 unsupported role
INSERT INTO resource_role VALUES ('R06','admin');
-- accept: BR-008 valid role
INSERT INTO resource_role VALUES ('R06','supervisor');
-- reject: BR-008 orphan record
INSERT INTO supervision_record VALUES ('assert_record','missing','2026-09-01','O','S','source','f.txt');
-- accept: BR-008 record on real opening
INSERT INTO supervision_record VALUES ('assert_record','K02','2026-09-01','O','S','source','f.txt');
-- reject: BR-008 referenced course deletion
DELETE FROM course WHERE id='C01';
-- accept: BR-008 removal of unused role assignment
DELETE FROM resource_role WHERE resource_id='R06';
-- reject: AT-003 negative credits
UPDATE course SET credits=-1 WHERE id='C01';
-- accept: AT-003 zero credits
UPDATE course SET credits=0 WHERE id='C01';
-- reject: BR-008 null identifier
UPDATE course SET id=NULL WHERE id='C01';
-- accept: AT-003 unknown course description remains null
UPDATE course SET description=NULL WHERE id='C01';
