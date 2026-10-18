# 爱教学数据设计交接

阅读顺序：`00-intake-report.md` → `01-data-requirements.md` / `01b-dbms-decision.md` → `02-conceptual-erd.md` → `03-logical-schema.md` / `03-data-dictionary.md` → `04-schema.sql` / `04-index-plan.md` / `04-migration-notes.md` → `05-assertions.sql` / `05-app-enforced-rules.md` / `05-traceability-matrix.md` / `05-review-report.md`。

本轮已完成阶段 0—5。SQLite 3.53.1 仅作为本地教学实现；生产数据库、学校授权策略和运维目标待业务方确认。`tests/check_design.py` 会在临时数据库中复核字典、DDL、29 条正反断言和样例查询计划。
