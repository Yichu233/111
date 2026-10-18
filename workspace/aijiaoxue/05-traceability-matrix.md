# 需求—实现—验证追溯

32条DR逐项登记；非数据库属性需求明确定位至应用或交付证据，不伪造数据库列。反向逐列映射位于03-data-dictionary.md；check_design.py核对字典列集合与真实DDL完全一致。

|DR|来源ID|落地对象/实现|验证|
|---|---|---|---|
|DR-001|BC-001|8表及只读HTTP；八条Must|原14项故事回归|
|DR-002|BC-002|app_user.role/department；Store.can_view|角色与外系隔离API|
|DR-003|AT-001|term.id/name|全种子逐值比对|
|DR-004|AT-002|app_user全部列|全种子比对、role CHECK|
|DR-005|AT-003|course全部列|简介NULL、credits约束、持久化重启|
|DR-006|AT-004|offering全部列|全种子比对、K03/K04状态|
|DR-007|AT-005|teaching_assignment两列|组合键唯一、联授去重|
|DR-008|AT-006|resource全部列|四状态、来源NULL、精确种子|
|DR-009|AT-007|resource_role两列|角色集与唯一/孤立约束|
|DR-010|AT-008|supervision_record全部列|记录及原始来源|
|DR-011|RL-001|offering.course_id/term_id FK|孤立课程/学期拒绝|
|DR-012|RL-002|teaching_assignment与3个trigger|插入/改任课/改身份成对验证|
|DR-013|RL-003|resource.course_id/offering_id|同课程专属/共用成功；孤立拒绝|
|DR-014|RL-004|supervision_record.offering_id FK|孤立记录拒绝，正确开课允许|
|DR-015|BR-001|Store.offerings/can_view；domain.offering_for|教师范围、主任督导系范围、同404|
|DR-016|BR-002|resource复合FK→offering(id,course_id)|跨课程拒绝及同课程更新成功|
|DR-017|BR-003|domain.resource_state|先权限后文件路径/存在性|
|DR-018|BR-004|resource.source/file NULL与状态呈现|R04/R05/R06分离；来源未提供|
|DR-019|BR-005|domain.supervision/record_source|正文与来源角色/开课范围|
|DR-020|BR-006|offering.records_state；JS失败与空态|K03已核对、K04未收全；失败不记零|
|DR-021|BR-007|EXISTS授权；表格按offering id|K01一次、两位教师；筛选计数|
|DR-022|BR-008|PK、FK、UNIQUE、CHECK|05-assertions及test_storage|
|DR-023|PR-001|进程会话、按学期/开课读取|token过期/替换；当前身份内容|
|DR-024|PR-002|Repository首建与已有文件验证|种子一次、双首建、重启/错误版本|
|DR-025|VP-001|精确模拟样本，无容量承诺|全种子比对，design-audit计数|
|DR-026|VP-002|6索引；授权关联SQL|样本EXPLAIN，真实规模未测试|
|DR-027|NF-001|标准库应用、README启动命令|本机测试、清洁副本检查由打包阶段补证|
|DR-028|NF-002|所有页面模拟标识；只读边界|界面截图/API，无真实学校账号|
|DR-029|NF-003|真实日志、独立升级分支、人工验收空白|docs/upgrade及最终打包清单|
|DR-030|XX-001|R04 missing-slides.txt保留|test_us072与四状态浏览器|
|DR-031|XX-002|K03/K04 records_state原文|浏览器已核对空与未知空|
|DR-032|XX-003|教师resources；主任督导supervision/resources|三角色桌面与键盘页签|

## 反向对象边界

term→DR-003；app_user→DR-004；course→DR-005；offering→DR-006/011/031；teaching_assignment→DR-007/012；resource→DR-008/013/016/018/030；resource_role→DR-009；supervision_record→DR-010/014/019。每列完整映射见03-data-dictionary.md，无缓存统计字段、人造审计日期或学校集成对象。

搜索、授课方式筛选、排序、重试改善现有查询使用方式，不增加批准故事编号。traceability_complete只表示这32条提取项均有映射，不代表人工验收通过。
