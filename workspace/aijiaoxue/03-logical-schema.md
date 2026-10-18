# 逻辑模型

8张表：term、app_user、course、offering、teaching_assignment、resource、resource_role、supervision_record。保留现有文本业务ID为主键，不额外生成无来源的数字ID，避免破坏故事、样例与测试的关联。

任课与资源角色集合拆表满足1NF；关系表只有组合键。课程属性不重复存于开课，任课教师名不存于关系表，统计数字按查询结果派生。资源的course_id定义课程共用范围，在开课专属情况下必须与offering.course_id一致，由组合外键保护；这是原业务作用域表达，不是统计缓存。没有性能反规范化DN决定。

所有引用默认RESTRICT删除，本轮无业务删除操作；没有审计生命周期、软删除、version列或人造创建时间。实际模拟来源与事实日期保留，未提供的业务审计信息不补造。role用CHECK集合，teacher任课资格用触发器保护INSERT/UPDATE及角色变更。核心查询走关联表，不能通过逗号拼接教师名单过滤权限。

|规则|实现计划|Stage 4验证|
|---|---|---|
|BR-002资源开课同课程|DB：resource(offering_id,course_id)组合外键|已由Stage 4配对断言验证|
|BR-008主键、组合唯一、孤立引用|DB：PK/FK/CHECK|已由Stage 4配对断言验证|
|RL-002仅教师任课|DB：插入/更新任课及变更用户角色trigger|已由Stage 4配对断言验证|
|BR-001、003—007|应用授权、文件状态、未知含义与派生统计|API与桌面检查已验证列明场景|

SQLite日期以ISO YYYY-MM-DD文字存储，事实日期不带时区；源数据字符串不转换成虚构时间戳。schedule是原始教学安排说明，不作为可计算课表或冲突检测模型。真实冲突排课不在本轮。

## Stage 4 amendments / 2026-10-11

BR-002、BR-008与RL-002从设计计划更新为已实测DB约束；没有DB规则降级到应用。增加明确的STRICT类型、user_version元数据与只读连接方案，不新增业务表或DN决定。启动会验证DDL签名，不能无声接受被删掉的约束。
