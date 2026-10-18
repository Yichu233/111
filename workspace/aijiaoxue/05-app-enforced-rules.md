# 应用执行规则交接

|规则/来源|为何在应用|实现位置|验证|
|---|---|---|---|
|BR-001 / DR-015|L1 请求身份与模拟系范围是会话策略|server.current_user；storage.Store.can_view/offerings；domain.offering_for|test_us014、test_supervision_permissions；浏览器身份延迟/失败切换|
|BR-003 / DR-017|L2 权限检查必须先于外部文件可用性|domain.resource_state先store.allows再fixture_path|test_controlled_file_paths_and_permission_before_existence；test_us072|
|BR-004 / DR-018|L2 文件变化在DB外；NULL来源不可补造|domain.resource_state/read_fixture；app.js资源状态|test_us052、test_missing_record_source；浏览器四状态|
|BR-005 / DR-019|L1 督导API/正文共享角色与开课授权|domain.supervision/record_source|test_us091_records_sources；test_supervision_permissions|
|BR-006 / DR-020|L3 未知、未核对、失败与零的业务解释|records_state原文；app.js列表/详情/空态|test_us091_missing_records；K03/K04浏览器检查|
|BR-007 / DR-021|L3 查询结果的开课去重和显示数量|EXISTS授权查询，不展开联授；app.js visibleOfferings|test_us011；表格联授过滤|

L1=请求上下文；L2=外部文件；L3=展示语义。无L4=因引擎选择失去可实施DB约束的规则。

数据库约束已覆盖BR-002、BR-008、RL-002；完整对象列表与配对断言见04-schema.sql和05-assertions.sql。事实日期为原始ISO文本，初始化种子以date.fromisoformat校验；未提供数据编辑API。绕过程序直接改DB可写入非法日期/伪造来源文字，不宣称DB辨认真伪；未来导入流程必须补验证。

失败重试：数据库读取错误503；页面列表、详情、关联内容、身份和bootstrap分别提供重试；仅重新执行只读查询或选择模拟身份。没有需要自动重放的业务写入。abort+epoch保护身份/学期/开课竞争；当前loadTab负责归位aria-busy，旧请求不得覆盖新上下文。
