"""只读模拟数据：课程、开课、任课关系分别建模，不包含真实师生数据。"""
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "fixtures"
TERMS = [
    {"id": "2026-fall", "name": "2026—2027 学年 · 秋季"},
    {"id": "2026-spring", "name": "2025—2026 学年 · 春季"},
    {"id": "2027-spring", "name": "2026—2027 学年 · 春季（暂无开课）"},
]
USERS = {
    "teacher-a": {"id": "teacher-a", "name": "林老师", "role": "teacher", "department": "计算机系"},
    "teacher-b": {"id": "teacher-b", "name": "陈老师", "role": "teacher", "department": "计算机系"},
    "teacher-empty": {"id": "teacher-empty", "name": "周老师（暂无任课）", "role": "teacher", "department": "计算机系"},
    "director": {"id": "director", "name": "教研室主任", "role": "director", "department": "计算机系"},
    "supervisor": {"id": "supervisor", "name": "教学督导", "role": "supervisor", "department": "计算机系"},
}
COURSES = {
    "C01": {"id": "C01", "code": "CS301", "name": "软件项目管理", "department": "计算机系", "credits": 3,
            "description": "学习项目范围、进度、质量和风险管理，通过 Scrum 实践体验从需求规划到软件增量交付的全过程。"},
    "C02": {"id": "C02", "code": "CS202", "name": "数据库原理", "department": "计算机系", "credits": 3, "description": None},
    "C03": {"id": "C03", "code": "CS204", "name": "软件测试基础", "department": "计算机系", "credits": 2,
            "description": "理解测试设计与缺陷跟踪，通过可复现的测试证据检查软件行为。"},
    "C99": {"id": "C99", "code": "MA101", "name": "外系示例课程", "department": "数学系", "credits": 4, "description": "授权范围外的模拟课程。"},
}
OFFERINGS = {
    "K01": {"id": "K01", "course_id": "C01", "term_id": "2026-fall", "class_name": "软件工程 2401", "teacher_ids": ["teacher-a", "teacher-b"], "schedule": "周二 3—4节 · 第1—16周", "room": "1号楼 B305", "records_state": "已收录模拟记录"},
    "K02": {"id": "K02", "course_id": "C01", "term_id": "2026-fall", "class_name": "软件工程 2402", "teacher_ids": ["teacher-a"], "schedule": "周四 1—2节 · 第1—16周", "room": "1号楼 B306", "records_state": "已收录模拟记录"},
    "K03": {"id": "K03", "course_id": "C02", "term_id": "2026-fall", "class_name": "计算机 2401", "teacher_ids": ["teacher-b"], "schedule": "周三 5—6节 · 第1—16周", "room": "2号楼 A201", "records_state": "当前登记范围已核对，未查询到记录"},
    "K04": {"id": "K04", "course_id": "C03", "term_id": "2026-fall", "class_name": "软件工程 2403", "teacher_ids": ["teacher-b"], "schedule": "周五 3—4节 · 第1—12周", "room": "2号楼 A202", "records_state": "资料未收全，督导情况待核实"},
    "K05": {"id": "K05", "course_id": "C01", "term_id": "2026-spring", "class_name": "软件工程 2301", "teacher_ids": ["teacher-a"], "schedule": "周二 1—2节 · 第1—16周", "room": "1号楼 B301", "records_state": "历史资料待核实"},
    "K99": {"id": "K99", "course_id": "C99", "term_id": "2026-fall", "class_name": "数学 2401", "teacher_ids": [], "schedule": "周一 1—2节", "room": "3号楼", "records_state": "待核实"},
}
RESOURCES = {
    "R01": {"id": "R01", "course_id": "C01", "offering_id": None, "name": "软件项目管理课程导读", "description": "课程共用资料，说明学习目标和查询范围。", "source": "第15组编写的模拟课程资料", "file": "course-guide.txt", "allowed_roles": ["teacher", "director", "supervisor"]},
    "R02": {"id": "R02", "course_id": "C01", "offering_id": "K01", "name": "2401班 Sprint 实践说明", "description": "仅适用于软件工程2401班的模拟实践材料。", "source": "第15组模拟教学安排", "file": "k01-sprint.txt", "allowed_roles": ["teacher", "director", "supervisor"]},
    "R03": {"id": "R03", "course_id": "C01", "offering_id": "K02", "name": "2402班项目讨论提纲", "description": "仅适用于软件工程2402班。", "source": "第15组模拟教学安排", "file": "k02-discussion.txt", "allowed_roles": ["teacher", "director", "supervisor"]},
    "R04": {"id": "R04", "course_id": "C01", "offering_id": "K01", "name": "历史课件入口示例", "description": "模拟已登记但目标文件不存在的入口。", "source": "模拟历史资料登记", "file": "missing-slides.txt", "allowed_roles": ["teacher", "director", "supervisor"]},
    "R05": {"id": "R05", "course_id": "C01", "offering_id": "K01", "name": "待补充资料入口", "description": "模拟来源和入口尚未提供的登记记录。", "source": None, "file": None, "allowed_roles": ["teacher", "director", "supervisor"]},
    "R06": {"id": "R06", "course_id": "C01", "offering_id": "K01", "name": "受限资料访问示例", "description": "仅模拟主任身份获准读取，用于检查权限不足提示。", "source": "第15组权限测试资料", "file": "restricted.txt", "allowed_roles": ["director"]},
}
RECORDS = {
    "D01": {"id": "D01", "offering_id": "K01", "date": "2026-09-15", "observer": "模拟督导甲", "summary": "已登记一次课堂听课活动。", "source": "模拟听课登记 D01", "source_file": "d01-source.txt"},
    "D02": {"id": "D02", "offering_id": "K01", "date": "2026-09-22", "observer": "模拟督导乙", "summary": "已登记一次教学材料查阅活动。", "source": "模拟材料查阅登记 D02", "source_file": "d02-source.txt"},
    "D03": {"id": "D03", "offering_id": "K02", "date": "2026-09-18", "observer": "模拟督导甲", "summary": "已登记一次课堂听课活动。", "source": "模拟听课登记 D03", "source_file": "d03-source.txt"},
}
