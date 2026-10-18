# 数据需求提取 Data requirements / Yêu cầu dữ liệu

来源编号见00-intake-report。用户于2026-10-10授权连续推进，各阶段成果保留可复核记录；未知业务仍不代为确认。中文为本项目交付语言，英文作为数据标识。

## S1 业务背景
|ID|DR追溯|要求|来源|置信|
|---|---|---|---|---|
|BC-001|DR-001|只读查询具体开课、关联资源及督导事实；沿用八条Must|BA-02 §三、四|高|
|BC-002|DR-002|教师、主任、督导按模拟授权范围查询；无真实学校认证|BA-04 can_view/supervision|高，限演示|

## S2 实体
|ID|实体|定义与业务键|来源|
|---|---|---|---|
|EN-001|term|学期，term_id|BA-03 TERMS|
|EN-002|user|模拟身份，user_id；角色值不是独立账号体系|BA-03 USERS|
|EN-003|course|课程档案，course_id；code是展示代码|BA-03 COURSES|
|EN-004|offering|某学期具体教学安排，offering_id|BA-03 OFFERINGS|
|EN-005|teaching_assignment|开课与任课教师的关联，不是新的开课|BA-03 teacher_ids|
|EN-006|resource|资料说明及文件入口，resource_id|BA-03 RESOURCES|
|EN-007|resource_role|资源允许访问的角色集合|BA-03 allowed_roles|
|EN-008|supervision_record|已登记督导事实及来源，record_id|BA-03 RECORDS|

## S3 属性
|ID|DR追溯|实体与属性|数据语义与空值|来源|
|---|---|---|---|---|
|AT-001|DR-003|term: id,name|均已提供；显示名称不是排序时间|BA-03 TERMS|
|AT-002|DR-004|user: id,name,role,department|role为teacher/director/supervisor；均已提供|BA-03 USERS|
|AT-003|DR-005|course: id,code,name,department,credits,description|description可NULL；credits为模拟学分，非学生数|BA-03 COURSES|
|AT-004|DR-006|offering: id,course_id,term_id,class_name,schedule,room,records_state|课程与开课分别标识；records_state是收集状态文字|BA-03 OFFERINGS|
|AT-005|DR-007|teaching_assignment: offering_id,user_id|组合身份避免联授重复；同一开课可无任课样本K99|BA-03 teacher_ids|
|AT-006|DR-008|resource: id,course_id,offering_id,name,description,source,file|offering_id NULL为课程共用；source/file允许NULL；file为本地相对入口|BA-03 RESOURCES|
|AT-007|DR-009|resource_role: resource_id,role|集合不能重复；受限角色不显示正文链接|BA-03 allowed_roles；BA-04 resource_state|
|AT-008|DR-010|supervision_record: id,offering_id,date,observer,summary,source,source_file|date为事实发生日期非提交时间；来源文件属于指定事实|BA-03 RECORDS|

## S4 关系
|ID|DR追溯|关系|基数与可选性|来源|
|---|---|---|---|---|
|RL-001|DR-011|course→offering，term→offering|1:N；每个开课必须有一个课程和学期|BA-03 OFFERINGS|
|RL-002|DR-012|user↔offering|N:M；只允许teacher担任授课教师|BA-03 teacher_ids；BA-04 can_view|
|RL-003|DR-013|course→resource，offering→resource|资料必须属课程；可选属该课程的一个开课|BA-04 related|
|RL-004|DR-014|offering→supervision_record|1:N；每条事实必须属一个开课|BA-04 supervision/record_source|

## S5 业务约束
|ID|DR追溯|规则|预期执行层|来源|
|---|---|---|---|---|
|BR-001|DR-015|教师仅查本人任课；主任/督导仅查同系；不存在与越权开课统一404|应用授权|BA-04 offering_for|
|BR-002|DR-016|资源course_id必须与非空offering_id所属课程一致|组合外键或应用约束|BA-04 related；US05.1|
|BR-003|DR-017|无权访问先返回权限不足，之后再判断入口存在/失效|应用状态顺序|BA-04 resource_state|
|BR-004|DR-018|资料缺入口、失效、无权与可访问必须分开；未知来源不补造|应用及NULL|BA-04 resource_state；US05.2/07.2|
|BR-005|DR-019|督导正文和来源沿用角色及开课范围授权|应用授权|BA-04 supervision/record_source|
|BR-006|DR-020|无督导记录不推断未督导；查询失败/未查询不显示零|应用状态|BA-04 supervision；现有app.js|
|BR-007|DR-021|联授开课按offering_id计一条；课程按course_id去重|查询派生，不保存统计快照|BA-05 README|
|BR-008|DR-022|主键、任课组合键和资源角色组合键唯一；孤立外键拒绝|PK/FK/UNIQUE|上述对象关系的实现约束建议，来源DR-003—014|

## S6 生命周期
|ID|DR追溯|过程|影响|来源|
|---|---|---|---|---|
|PR-001|DR-023|选择模拟身份，按学期查询，选开课查关联|业务数据只读；会话在进程内限时|BA-05 server.py和README|
|PR-002|DR-024|初始化模拟数据|开发/演示引导，不提供用户CRUD；不覆盖已有存储|BA-06升级授权；技术建议|

## S7 规模与性能
|ID|DR追溯|内容|结论|来源|
|---|---|---|---|---|
|VP-001|DR-025|现有样例：3学期、5身份、4课程、6开课、6资源、3事实|仅测试样例，真实规模未知|BA-03|
|VP-002|DR-026|高频路径：学期和授权开课、所属资源、所属督导事实|应建关系索引；无已批准延迟SLA或并发量|BA-04|

## S8 非功能要求
|ID|DR追溯|要求|来源|
|---|---|---|---|
|NF-001|DR-027|Windows本机可运行、操作说明明确、核心流程有基本测试及关键注释|BA-01基本要求5；BA-05|
|NF-002|DR-028|明确模拟数据；无学校接入、真实认证或生产个人信息|BA-02、BA-05|
|NF-003|DR-029|可复现、真实版本和测试证据；AI产出需人类审查后合入|BA-01基本要求3—5|

## S9 补充发现
|ID|DR追溯|发现与影响|来源|
|---|---|---|---|
|XX-001|DR-030|R04故意指向不存在文件，用于失效测试；不能因初始化完整性检查把这个样例“修好”|BA-03 R04|
|XX-002|DR-031|K03“已核对无记录”和K04“未收全”都有空数组但语义不同；不能只用record_count表达业务状态|BA-03 K03/K04|
|XX-003|DR-032|旧浏览器脚本仍期待教师点击督导页签，新界面已隐藏；需要改测试断言，不能恢复不必要入口迎合旧脚本|BA-05 tests/browser_smoke.cjs:60；app.js roleProfiles|

## 冲突和未决项
正式学校授权、真实并发量、保留期、生产RPO/RTO未提供。本轮仅形成教学模拟版设计；不自动追加软删除、审计流水、多租户或学校账号实体。第三遍复核补充XX-001—003。故事原编号不变，新交互改进在改造清单独立登记。
