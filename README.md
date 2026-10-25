# 第15组 爱教学 Sprint 1源代码

爱教学面向教师、教研室主任和教学督导。本交付以功能基线 `c82ae38` 为准，包含课程查询、资料读取和督导事实查询，以及后续形成的本地教学协作工作空间。功能代码、测试与最终六份报告保持同一基线；本次交付整理仅更新运行及审核说明。

## 一 启动项目

应用运行需要 Python 3.11或以上，使用标准库与SQLite，无需另装Python运行依赖。将压缩包完整解压到本地可写目录，进入含有本文件、`app` 和 `tests` 的目录。

Windows可双击 `启动项目.cmd`；也可以打开终端执行：

```powershell
python -m app.server --port 18775
```

浏览器访问 <http://127.0.0.1:18775/>。保持服务终端运行；结束时按 Ctrl+C。端口占用时可改成18776，并相应访问新端口。应用默认仅监听本机，不需要连接学校系统。

需要独立演示副本时，指定另一个数据库目录：

```powershell
python -m app.server --port 18776 --database var/independent/aijiaoxue.sqlite3
```

首次启动会在该目录创建只读查询库 `aijiaoxue.sqlite3` 和教学场景库 `campus.sqlite3`；以后启动读取原库。压缩包中的 `var` 保留当前本地场景快照，属于演示数据。不要直接删除已有数据库；需要重现初始场景时使用上述独立目录。

## 二 三种角色的使用路径

门户选择场景身份与账号后进入工作空间。身份切换用于本地业务演示，不代表已接入大学统一身份认证。

| 身份 | 常用任务路径 |
|---|---|
| 教师 | 本人任课→开课详情→课程资料→课前准备；阅读已提交督导反馈，回复主任跟进 |
| 教研室主任 | 开课台账→教学核查→课程详情→安排听课或发起跟进→复核教师回复 |
| 教学督导 | 听课任务→课程和资料→记录草稿→检查完整性与日期→正式提交 |

教师以陈知远等5名场景教师验证不同任课范围；主任场景账号为陆明，督导为许文清。身份名称及课程任务均有场景标识。

全局学期选择会同步课程、资料、听课、跟进及统计。当前种子为2026秋季；其他学期无开课时显示空态，历史学期只读。资料分为本开课专属与本学期同课程共用；共用可读范围不会扩大编辑权，发布教师才能维护共用资料。

公开课程库支持查询公开认定目录并追溯原始出处。任务、教学周历、个人设置与帮助提供辅助入口；课程详情的返回路径保留筛选及所选开课。

## 三 原8条Must故事

| 编号 | 内容 | 主要检查位置 |
|---|---|---|
| US01.1 | 按学期浏览开课 | `test_terms_resources.py`、`browser_terms_resources.cjs` |
| US01.4 | 查看本人任课 | `test_sprint1.py`、`test_campus.py` |
| US02.1 | 查看课程基本信息 | `test_course_evidence.py`、`browser_course_evidence.cjs` |
| US02.2 | 查看开课详情 | `test_sprint1.py`、`browser_polish.cjs` |
| US05.1 | 查看资源目录 | `test_terms_resources.py`、`browser_terms_resources.cjs` |
| US05.2 | 查看资料说明与来源 | `test_course_evidence.py`、`browser_course_evidence.cjs` |
| US07.2 | 访问关联资料 | `test_sprint1.py`、`browser_polish.cjs`、`browser_terms_resources.cjs` |
| US09.1 | 查询督导事实与来源 | `test_sprint1.py`、`test_campus.py`、`test_workspace.py` |

原Sprint 1是上述8条查询故事。资料修订、备课、听课填报、回复复核及公共工作空间为后续扩展，按各阶段代码分别留存。查询、扩展功能与验证范围不按测试数量换算故事数量。

## 四 运行测试

服务端单元和集成测试只需Python：

```powershell
python -m unittest discover -s tests -v
python tests/check_design.py
python tests/check_release.py
```

当前功能基线有66项Python测试；数据设计检查另核对早期只读模型的32项需求、8表37列与29条约束断言，不能把这些断言当作当前教学场景测试数量。测试使用独立临时数据库。

桌面浏览器检查需要Node.js、Microsoft Edge和Playwright。当前验证环境使用Node.js 24.22.1、Playwright 1.62.1。其他电脑可在项目目录安装相同Playwright版本后执行：

```powershell
npm install --no-save --package-lock=false playwright@1.62.1
python tests/run_browser_suite.py
```

脚本自动启动随机本机端口和独立测试数据库，依次执行当前七套浏览器脚本，共57组检查（11+11+9+1+12+6+7）。结果生成在 `artifacts/campus`。历史界面脚本不属于当前默认套件。运行程序本身不需要Node.js。

检查源码压缩包解压后是否能独立启动：

```powershell
python tests/check_release.py --archive "源码压缩包的实际路径.zip"
```

## 五 数据与适用范围

- 公开资料：东北大学教务处345条课程认定记录与18条2018年在线课程资料。来源页、原表位置、快照和哈希保留在 `docs/public-data` 与 `app/public_catalog.json`。
- 独立教学场景：12个开课单元、11个课程名称、5名教师及主任和督导、22份初始文本、6项听课任务和2项跟进。姓名、任课、人数与课堂内容为场景编写，不代表学校实际人员及业务。
- 场景日历固定为2026-10-15，操作审计记录真实北京时间。常规周课表不代表真实校历或节假日调课。
- 课程与具体开课分开管理，联合授课不重复计数，人数按学生人次显示。督导覆盖按本场景学期有已提交记录的开课去重数/本学期开课数计算，初始为2/12，约17%；无可见记录不等于未督导，未知数据不填零。
- 文本资料可登记、阅读和保留版本。未实现任意附件上传、成绩管理、自动评分、视频分析、真实SSO、学校数据库连接或生产权限运维。本轮按桌面环境使用。

## 六 目录与关键代码

```text
app/                 Python服务端、数据规则、静态前端及资料
  server.py          HTTP路由、会话与本机服务入口
  campus.py          教学场景、学期与资料范围、授权及状态规则
  domain.py          原只读故事的领域查询
  storage.py         SQLite持久化与初始化
  static/            三角色工作台、门户与课程阅读页面
tests/               单元、接口、浏览器和交付检查
workspace/aijiaoxue/  数据需求、模型、DDL、数据字典与追溯
docs/                公开来源、设计、阶段验证及版本管理
var/                 本地数据库快照；Git忽略运行数据
版本记录/            完整Git bundle、真实提交清单和分支图
验证记录/            本次交付复核与包内容校验
```

关键模块使用文档字符串和注释说明对象关联、权限、兼容读取、事务、版本冲突与异常处理；例如 `campus.py` 的旧库兼容读取、`storage.py` 的初始化与存储规则以及浏览器测试的隔离说明。

## 七 分支 提交与人工审核

功能基线保留在 `codex/sprint1-scope-completion` 的 `c82ae38`。本轮DRI李延杰已明确确认全部故事、待办事项和人工核对通过；审核清单见 `docs/人工审查与验收清单.md`。本次只整理文档的 `codex/sprint1-submission` 分支与该功能代码一致，整合至本地main后打包，不推送远端。

原型分支 `codex/sprint1` 保留原始提交；`codex/import-*` 为留存源码快照的实际导入与复验；质量、故事对齐和范围补强分支保留后续差异。导入记录沿用真实发生时间，原对象、作者及提交时间保持原样。

在安装Git的环境中恢复完整版本：

```powershell
git clone "版本记录/爱教学_完整版本历史.bundle" "爱教学_恢复仓库"
git -C "爱教学_恢复仓库" log --graph --decorate --oneline --all
git -C "爱教学_恢复仓库" branch -a
```

Git恢复包含源码与全部历史，不含被忽略的业务数据库；需要保留当前演示状态时，将压缩包内 `var` 复制到恢复仓库，或使用新目录初始化。

功能基线的历史验证为66项Python、57组浏览器及独立副本启动通过。`验证记录` 另保存本次实际复核输出；历史日志注明各自适用版本。软件可运行与代码审核结论不能代替真实学校业务验收。
