# 物理索引与查询计划

2026-10-11；SQLite >=3.37，STRICT；实际引擎版本见 design-audit JSON。

|ID|查询与来源|索引|理由及代价|
|---|---|---|---|
|IX-001|按学期列开课 DR-026|ix_offering_term(term_id,id)|等值学期后按开课排序；6条样本，非规模承诺|
|IX-002|课程关联/父表约束 DR-011|ix_offering_course(course_id)|开课侧FK查找；小额额外写入与存储|
|IX-003|教师本人任课 DR-015|ix_assignment_user(user_id,offering_id)|EXISTS授权不因联授复制开课；另一方向由组合PK覆盖|
|IX-004|课程共用/开课专属资源 DR-013、016|ix_resource_scope(course_id,offering_id,id)|同课程过滤，保留NULL共用语义；OR及排序可能使用临时B-tree|
|IX-005|资源开课组合FK DR-016|ix_resource_offering(offering_id,course_id)|子侧FK两列顺序覆盖|
|IX-006|按开课及日期展示事实 DR-014、026|ix_record_offering_date(offering_id,date,id)|日期+ID稳定排序，源事实不合并|

term、app_user、course主键覆盖父对象查找。resource_role(resource_id,role)及teaching_assignment(offering_id,user_id)的组合主键覆盖相应子表查询。offering(id,course_id)唯一键是复合FK所需目标；不额外声明课程展示代码全局唯一。

搜索、联授筛选与排序只对已授权并成功返回的有限样本在浏览器内执行，无搜索服务、全表SQL模糊查询或未经测量的分页阈值。真实规模未知；当前不分区、归档、缓存、队列或副本。若新增真实学校规模与写入，再重新评估。没有共享更新计数器。

`python tests/check_design.py`输出样本上的EXPLAIN QUERY PLAN。它验证索引路径可以执行，不证明大数据性能；未执行真实规模负载测试，没有虚构响应时间SLA。
