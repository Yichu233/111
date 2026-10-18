# 数据字典

所有列默认值为无；标为可空的列才可NULL。表和列为英文snake_case。下表逐列列出，DDL实现时应保持一致。

|表|列|类型|可空|键与约束|含义与来源|
|---|---|---|---|---|---|
|term|id|TEXT|否|PK|学期ID DR-003|
|term|name|TEXT|否||学期名称 DR-003|
|app_user|id|TEXT|否|PK|模拟身份ID DR-004|
|app_user|name|TEXT|否||姓名/角色展示 DR-004|
|app_user|role|TEXT|否|CHECK角色集合|身份类型 DR-004|
|app_user|department|TEXT|否||模拟所属系 DR-004|
|course|id|TEXT|否|PK|课程ID DR-005|
|course|code|TEXT|否||课程展示代码；未声称学校全局唯一 DR-005|
|course|name|TEXT|否||课程名 DR-005|
|course|department|TEXT|否||开课单位 DR-005|
|course|credits|REAL|否|CHECK>=0|模拟学分 DR-005|
|course|description|TEXT|是||简介未提供保留NULL DR-005|
|offering|id|TEXT|否|PK|开课ID DR-006|
|offering|course_id|TEXT|否|FK course|所属课程 DR-011|
|offering|term_id|TEXT|否|FK term|学期 DR-011|
|offering|class_name|TEXT|否||教学班 DR-006|
|offering|schedule|TEXT|否||原始安排说明 DR-006|
|offering|room|TEXT|否||原始地点说明 DR-006|
|offering|records_state|TEXT|否||资料收集状态 DR-006/031|
|teaching_assignment|offering_id|TEXT|否|PK1/FK offering|任课关联 DR-007|
|teaching_assignment|user_id|TEXT|否|PK2/FK app_user/teacher trigger|任课教师 DR-007/012|
|resource|id|TEXT|否|PK|资料ID DR-008|
|resource|course_id|TEXT|否|FK course；组合FK|资料所属课程 DR-008/016|
|resource|offering_id|TEXT|是|组合FK offering(id,course_id)|NULL表示课程共用 DR-008/016|
|resource|name|TEXT|否||资料标题 DR-008|
|resource|description|TEXT|否||说明 DR-008|
|resource|source|TEXT|是||来源未提供保留NULL DR-008/018|
|resource|file|TEXT|是||本地入口名；失效样例合法 DR-008/030|
|resource_role|resource_id|TEXT|否|PK1/FK resource|资料关联 DR-009|
|resource_role|role|TEXT|否|PK2/CHECK角色集合|允许角色 DR-009|
|supervision_record|id|TEXT|否|PK|事实ID DR-010|
|supervision_record|offering_id|TEXT|否|FK offering|所属开课 DR-010/014|
|supervision_record|date|TEXT|否|ISO日期，应用校验种子|事实日期 DR-010|
|supervision_record|observer|TEXT|否||模拟登记人员 DR-010|
|supervision_record|summary|TEXT|否||事实摘要 DR-010|
|supervision_record|source|TEXT|否||来源说明 DR-010|
|supervision_record|source_file|TEXT|否||受控来源文件 DR-010/019|

业务角色授权、文件存在性、未知与零的区别、聚合去重由应用执行，不能误记为数据库已强制执行。
