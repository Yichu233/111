-- SQLite >= 3.37; dbms_status: decided_for_teaching_implementation.
-- Schema v1. Seed values live in data.py; initialize through storage.Repository.
CREATE TABLE term (
 id TEXT NOT NULL CONSTRAINT pk_term PRIMARY KEY,
 name TEXT NOT NULL
) STRICT;
CREATE TABLE app_user (
 id TEXT NOT NULL CONSTRAINT pk_app_user PRIMARY KEY,
 name TEXT NOT NULL,
 role TEXT NOT NULL CONSTRAINT ck_app_user_role CHECK(role IN ('teacher','director','supervisor')),
 department TEXT NOT NULL
) STRICT;
CREATE TABLE course (
 id TEXT NOT NULL CONSTRAINT pk_course PRIMARY KEY,
 code TEXT NOT NULL,
 name TEXT NOT NULL,
 department TEXT NOT NULL,
 credits REAL NOT NULL CONSTRAINT ck_course_credits CHECK(credits >= 0),
 description TEXT
) STRICT;
CREATE TABLE offering (
 id TEXT NOT NULL CONSTRAINT pk_offering PRIMARY KEY,
 course_id TEXT NOT NULL CONSTRAINT fk_offering_course REFERENCES course(id) ON DELETE RESTRICT,
 term_id TEXT NOT NULL CONSTRAINT fk_offering_term REFERENCES term(id) ON DELETE RESTRICT,
 class_name TEXT NOT NULL,
 schedule TEXT NOT NULL,
 room TEXT NOT NULL,
 records_state TEXT NOT NULL,
 CONSTRAINT uq_offering_course UNIQUE(id,course_id)
) STRICT;
CREATE TABLE teaching_assignment (
 offering_id TEXT NOT NULL CONSTRAINT fk_teaching_assignment_offering REFERENCES offering(id) ON DELETE RESTRICT,
 user_id TEXT NOT NULL CONSTRAINT fk_teaching_assignment_user REFERENCES app_user(id) ON DELETE RESTRICT,
 CONSTRAINT pk_teaching_assignment PRIMARY KEY(offering_id,user_id)
) STRICT;
CREATE TABLE resource (
 id TEXT NOT NULL CONSTRAINT pk_resource PRIMARY KEY,
 course_id TEXT NOT NULL CONSTRAINT fk_resource_course REFERENCES course(id) ON DELETE RESTRICT,
 offering_id TEXT,
 name TEXT NOT NULL,
 description TEXT NOT NULL,
 source TEXT,
 file TEXT,
 CONSTRAINT fk_resource_offering_course FOREIGN KEY(offering_id,course_id) REFERENCES offering(id,course_id) ON DELETE RESTRICT
) STRICT;
CREATE TABLE resource_role (
 resource_id TEXT NOT NULL CONSTRAINT fk_resource_role_resource REFERENCES resource(id) ON DELETE RESTRICT,
 role TEXT NOT NULL CONSTRAINT ck_resource_role CHECK(role IN ('teacher','director','supervisor')),
 CONSTRAINT pk_resource_role PRIMARY KEY(resource_id,role)
) STRICT;
CREATE TABLE supervision_record (
 id TEXT NOT NULL CONSTRAINT pk_supervision_record PRIMARY KEY,
 offering_id TEXT NOT NULL CONSTRAINT fk_supervision_record_offering REFERENCES offering(id) ON DELETE RESTRICT,
 date TEXT NOT NULL,
 observer TEXT NOT NULL,
 summary TEXT NOT NULL,
 source TEXT NOT NULL,
 source_file TEXT NOT NULL
) STRICT;
CREATE INDEX ix_offering_term ON offering(term_id,id);
CREATE INDEX ix_offering_course ON offering(course_id);
CREATE INDEX ix_assignment_user ON teaching_assignment(user_id,offering_id);
CREATE INDEX ix_resource_scope ON resource(course_id,offering_id,id);
CREATE INDEX ix_resource_offering ON resource(offering_id,course_id);
CREATE INDEX ix_record_offering_date ON supervision_record(offering_id,date,id);
CREATE TRIGGER teaching_assignment_teacher_insert BEFORE INSERT ON teaching_assignment
 WHEN NOT EXISTS(SELECT 1 FROM app_user WHERE id=NEW.user_id AND role='teacher')
 BEGIN SELECT RAISE(ABORT,'teaching assignment requires a teacher'); END;
CREATE TRIGGER teaching_assignment_teacher_update BEFORE UPDATE OF user_id ON teaching_assignment
 WHEN NOT EXISTS(SELECT 1 FROM app_user WHERE id=NEW.user_id AND role='teacher')
 BEGIN SELECT RAISE(ABORT,'teaching assignment requires a teacher'); END;
CREATE TRIGGER app_user_teacher_update BEFORE UPDATE OF role ON app_user
 WHEN NEW.role <> 'teacher' AND EXISTS(SELECT 1 FROM teaching_assignment WHERE user_id=OLD.id)
 BEGIN SELECT RAISE(ABORT,'assigned teacher cannot change role'); END;
PRAGMA user_version=1;
