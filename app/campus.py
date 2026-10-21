"""Local campus workflow scenario. Public catalog facts never become claimed school records."""
import json,sqlite3,secrets,time
from contextlib import contextmanager
from pathlib import Path
from datetime import date,datetime,timedelta,timezone
from http.cookies import SimpleCookie
from .domain import APIError
ROOT=Path(__file__).resolve().parent
USERS=[{'id':'t1','name':'陈知远','role':'teacher'},{'id':'t2','name':'周宁','role':'teacher'},{'id':'t3','name':'顾思齐','role':'teacher'},{'id':'t4','name':'宋嘉禾','role':'teacher'},{'id':'t5','name':'林悦','role':'teacher'},{'id':'d1','name':'陆明','role':'director'},{'id':'s1','name':'许文清','role':'supervisor'}]
ASOF='2026-10-15'

COURSE_CONTENT={
 '软件项目管理':('范围与需求、WBS与进度、成本与质量、风险与沟通、敏捷迭代','以课程查询为例，先写用户目标和验收条件，再将故事拆成可演示的增量。识别数据来源、权限与排期依赖；估算采用区间，并记录假设。','小组从一个故事出发给出任务清单、责任人和完成定义；讨论依赖未满足时如何调整迭代范围。'),
 '软件工程':('软件生命周期、需求规格、结构设计、验证确认、配置管理','对比顺序开发与迭代开发，区分需求变更、设计缺陷与实现缺陷。用需求到测试的追踪表解释为什么每项验收需要证据。','每组使用“问题—证据—建议—负责人”四列表记录讨论结果，下一次课复核采纳情况。'),
 '软件需求分析与设计':('利益相关者、业务场景、用户故事、领域模型、需求验证','从课程检索场景识别角色、前置条件、主路径与例外路径。区分课程和开课单元；将未知数据状态纳入验收条件。','分别编写按课程名检索、无匹配结果、无权读取资料三个场景，不将页面按钮当作用户目标。'),
 '计算机网络':('网络分层、链路层、网络层、传输层、应用层','路由步骤对照：距离向量交换相邻节点代价并迭代更新；链路状态先收集拓扑，再计算最短路径。讨论链路代价变化、不可达节点与环路边界。','绘制四节点网络，分别记录初始化、松弛更新、收敛三阶段的路由表，并说明节点不可达时的表示方法。'),
 'Linux操作系统':('文件系统、用户权限、进程管理、Shell工具、服务配置','对比读写执行权限在文件和目录上的含义，解释用户、组与其他用户三类权限；使用受控实验目录观察进程状态。','在独立实验目录完成权限分析，记录预期与实际行为；不对系统目录执行递归权限修改。'),
 '操作系统':('进程与线程、同步互斥、调度、存储管理、文件系统','以生产者消费者说明临界区、互斥量与同步信号的区别，分析先后顺序不当导致的死锁。','绘制两个进程的执行序列，标记进入临界区、阻塞与唤醒的时刻，解释是否满足互斥。'),
 '计算机组成原理':('数据表示、运算器、存储层次、指令系统、输入输出','根据指令格式拆解操作码与地址字段，比较立即、直接和间接寻址，追踪一次访存路径。','为给定指令画出取指、译码和执行流程，列出寄存器与主存状态变化。'),
 '编译方法':('词法分析、语法分析、语义分析、中间代码、代码优化','区分终结符与非终结符，计算简单文法的FIRST与FOLLOW集合，识别预测分析冲突。','对表达式文法构造分析表，展示输入串逐步匹配过程，并解释一个不合法输入的错误位置。'),
 '软件体系结构与设计模式':('架构视图、分层结构、质量属性、常用设计模式、架构评估','围绕数据访问与业务逻辑分离讨论职责边界；比较策略模式与简单条件分支在扩展需求下的取舍。','给课程检索功能画出界面、应用服务与数据访问三层依赖，检查是否存在反向依赖。'),
 '程序设计基础':('数据类型、分支循环、函数、数组、文件与模块','将重复计算封装为函数，区分参数、返回值和副作用；使用小输入追踪边界与空集合情形。','将成绩汇总流程拆成读取、校验和统计三个函数；说明空输入不能被直接解释为零分。'),
 '算法分析与设计':('复杂度、分治、贪心、动态规划、图算法','用背包问题说明状态定义、转移方程、初始边界与计算顺序，区分局部选择和全局最优。','手工填写小规模状态表，再分析一维优化时正序与倒序更新的差异。')}
def material_body(name,topic,kind):
 structure,notes,exercise=COURSE_CONTENT[name]
 base='【独立教学场景编写，非学校实际文件】\n课程：'+name+'\n'
 if kind=='教学大纲':return base+'\n课程内容\n'+structure+'。\n\n教学目标\n能够解释关键概念，分析典型问题，并用明确的过程或证据说明结论。\n\n教学组织\n概念讲授、案例分析、独立练习、小组讨论。课堂材料按周维护，反馈由任课教师逐项处理。\n\n本周教学衔接\n'+topic+'。'
 return base+'本周主题：'+topic+'\n\n课前阅读要点\n'+notes+'\n\n课堂练习\n'+exercise+'\n\n学习证据\n保留推导步骤、讨论记录与一个仍待澄清的问题，课堂结束后复核。'

def seed():
 catalog=json.loads((ROOT/'public_catalog.json').read_text('utf-8'))['items']
 specs=[('软件项目管理','t1',2,1,'软件工程2401',38),('软件项目管理','t2',3,2,'软件工程2402',41),('软件工程','t1',0,1,'软件工程2301',40),('软件需求分析与设计','t1',3,0,'软件工程2401',38),('计算机网络','t2',1,1,'软件工程2402',41),('Linux操作系统','t2',4,1,'软件工程2403',36),('操作系统','t3',0,2,'软件工程2403',36),('计算机组成原理','t3',2,0,'软件工程2404',39),('编译方法','t4',1,2,'软件工程2302',37),('软件体系结构与设计模式','t4',3,1,'软件工程2302',37),('程序设计基础','t5',4,0,'软件工程2501',42),('算法分析与设计','t5',2,2,'软件工程2404',39)]
 topics=['Sprint计划与需求拆解','项目风险识别','软件过程与团队协作','场景分析与需求验证','网络层与路由选择','Linux进程与权限管理','进程同步与互斥','指令系统与寻址方式','语法分析方法','设计模式与系统分层','函数与模块化设计','动态规划问题求解']
 courses=[];resources=[]
 for i,(name,teacher,day,slot,cl,n) in enumerate(specs):
  c=next(x for x in catalog if x['name']==name and x['department']=='软件学院');cid=f'CL-{i+1:02}'
  courses.append({'id':cid,'catalog_id':c['id'],'name':name,'class_name':cl,'teachers':[teacher,'t2'] if i==0 else [teacher],'day':day,'slot':slot,'room':f'教学楼{201+i}','students':n,'topic':topics[i],'weeks':'第1—16周','prepared':i not in [0,3,5],'category':['blue','apricot','mint','lilac'][i%4]})
  for kind in ['教学大纲','课前材料']:
   if kind=='课前材料' and i in [3,5]:continue
   resources.append({'id':f'RS-{len(resources)+1:03}','course_id':cid,'title':name+' · '+('教学大纲' if kind=='教学大纲' else topics[i]),'kind':kind,'body':material_body(name,topics[i],kind),'created':'2026-10-12','author':teacher})
 tasks=[{'id':f'OB-{i+1:02}','course_id':cid,'observer':'s1','date':dt,'status':status,'report':report} for i,(cid,dt,status,report) in enumerate([
 ('CL-03','2026-10-12','submitted',{'organization':'课堂按概念讲解、案例讨论和归纳总结推进，主要环节衔接清楚。','content':'软件过程与团队分工的示例能够对应教学目标，关键术语进行了说明。','interaction':'小组讨论有明确问题，部分学生参与较少，可增加点名分享机会。','suggestion':'建议将小组讨论结果整理为简短记录，并在下一次课反馈共性问题。'}),
 ('CL-05','2026-10-13','submitted',{'organization':'课程节奏平稳，板书与讲解能够对应，练习时间安排合理。','content':'路由选择的步骤解释完整，案例涵盖常见边界情况。','interaction':'课堂提问有即时反馈，建议增加学生独立推导环节。','suggestion':'补充路由算法步骤对照表，便于学生课后复习。'}),
 ('CL-04','2026-10-15','planned',{}),('CL-02','2026-10-15','planned',{}),('CL-06','2026-10-16','planned',{}),('CL-10','2026-10-22','planned',{})])]
 return {'as_of':ASOF,'term':'2026—2027学年 秋季学期','term_start':'2026-09-07','mode':'scenario','organization':'软件教学中心（场景组织）','courses':courses,'resources':resources,'tasks':tasks,'followups':[{'id':'FU-01','course_id':'CL-03','title':'补充小组讨论记录方式','description':'根据10月12日听课反馈，在课前材料中明确小组记录模板和汇报规则。','due':'2026-10-19','status':'open','reply':'','created':'2026-10-13'},{'id':'FU-02','course_id':'CL-05','title':'补充路由算法对照表','description':'对照本周教学目标，增加步骤对照和边界案例。','due':'2026-10-16','status':'replied','reply':'已在课前材料中补充对照说明，待主任复核。','created':'2026-10-14'}],'audit':[]}
@contextmanager
def connection(server):
 """在同一SQLite连接中提交场景变更；发生异常时回滚，已有状态不重新播种。"""
 path=Path(server.campus_database);path.parent.mkdir(parents=True,exist_ok=True)
 c=sqlite3.connect(path,timeout=10);c.execute('CREATE TABLE IF NOT EXISTS campus_state (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, payload TEXT NOT NULL)')
 c.execute('CREATE TABLE IF NOT EXISTS campus_preferences (user_id TEXT PRIMARY KEY, payload TEXT NOT NULL)')
 if not c.execute('SELECT 1 FROM campus_state WHERE id=1').fetchone():
  c.execute('INSERT OR IGNORE INTO campus_state VALUES(1,1,?)',(json.dumps(seed(),ensure_ascii=False),))
 c.commit()
 try:
  yield c
  c.commit()
 except Exception:
  c.rollback()
  raise
 finally:c.close()
def read(server):
 """同时读取状态版本与业务快照，写入时用版本号识别其他窗口的更新。"""
 with connection(server) as c:v,raw=c.execute('SELECT version,payload FROM campus_state WHERE id=1').fetchone()
 return v,json.loads(raw)
def account(h):
 """以服务器保存且未过期的本地场景会话确定身份，不信任请求中的角色声明。"""
 cookies=SimpleCookie()
 try:cookies.load(h.headers.get('Cookie',''))
 except Exception:pass
 token=cookies.get('campus_session')
 with h.server.session_lock:session=h.server.campus_sessions.get(token.value if token else '')
 if not session or session[1]<time.time():raise APIError(401,'session_required','请选择场景工作身份。')
 return next(u for u in USERS if u['id']==session[0])
def visible(data,user):
 """复制后按任课范围裁剪；草稿及草稿动态只保留给对应督导，避免向其他身份泄露。"""
 d=json.loads(json.dumps(data));cs=[c for c in d['courses'] if user['role']!='teacher' or user['id'] in c['teachers']];ids={c['id'] for c in cs};d['courses']=cs
 d['resources']=[r for r in d['resources'] if r['course_id'] in ids]
 # Reuse existing scenario outlines without inventing official course codes or
 # altering stored business data when an older database is opened.
 for course in cs:
  outline=COURSE_CONTENT.get(course['name'])
  course['course_information']={'name':course['name'],'code':None,'introduction':outline[0]+'。' if outline else None,'source':'独立教学场景课程说明，非学校官方简介'}
 for resource in d['resources']:
  resource['scope']='offering';resource['scope_label']='本开课专属'
  resource['source']=material_source(resource)
 d['tasks']=[t for t in d['tasks'] if t['course_id'] in ids and (user['role']=='director' or (user['role']=='teacher' and t['status']=='submitted') or (user['role']=='supervisor' and t['observer']==user['id']))]
 for t in d['tasks']:
  if user['role']!='supervisor' and t['status']!='submitted':t['report']={}
 d['followups']=[f for f in d['followups'] if f['course_id'] in ids]
 d['audit']=[a for a in d['audit'] if a['course_id'] in ids and (a['action']!='保存听课草稿' or a['actor']==user['name'])][-100:]
 return d
def material_source(resource):
 """Keep provenance separate from author/date; a missing source stays unknown."""
 if 'source' in resource:return resource['source']
 return '独立教学场景编写（非学校实际文件）' if resource.get('body','').startswith('【独立教学场景编写，非学校实际文件】') else None
def source_input(payload):
 """An optional source is descriptive text only, never a fetched external URL."""
 value=payload.get('source','')
 if not isinstance(value,str) or len(value)>500:raise APIError(400,'invalid_source','资料来源应为不超过500个字符的文字。')
 return value.strip() or None
def preferences(server,user):
 """按场景账号读取偏好；未设置时返回新默认值，避免不同账号共享可变列表。"""
 with connection(server) as c:row=c.execute('SELECT payload FROM campus_preferences WHERE user_id=?',(user['id'],)).fetchone()
 return json.loads(row[0]) if row else {'density':'comfortable','landing':'home','pinned':[],'read_events':[]}
def get(h,path):
 if path=='/api/campus/bootstrap':
  try:u=account(h)
  except APIError:u=None
  h.reply(200,{'users':USERS,'user':u,'mode':'scenario'});return
 u=account(h)
 if path=='/api/campus/preferences':
  h.reply(200,preferences(h.server,u));return
 if path!='/api/campus/state':raise APIError(404,'not_found','接口不存在。')
 version,data=read(h.server);h.reply(200,{'version':version,'user':u,'users':USERS,'data':visible(data,u)})
def text(p,k,minimum=1,maximum=2000):
 v=p.get(k)
 if not isinstance(v,str) or not minimum<=len(v.strip())<=maximum:raise APIError(400,'invalid_field',f'{k}内容应为{minimum}—{maximum}个字符。')
 return v.strip()
def post(h,path):
 """校验请求、场景权限及流程状态；业务写入在事务中检查版本，防止旧页面覆盖新状态。"""
 origin=h.headers.get('Origin')
 if origin and origin!='http://'+h.headers.get('Host',''):raise APIError(403,'origin_rejected','不接受跨站操作。')
 if h.headers.get('Content-Type','').split(';')[0]!='application/json':raise APIError(415,'invalid_type','需要JSON请求。')
 try:size=int(h.headers.get('Content-Length','0'))
 except ValueError:raise APIError(400,'invalid_size','请求长度无效。')
 if not 0<size<=50000:raise APIError(400,'invalid_size','请求内容过大或为空。')
 try:p=json.loads(h.rfile.read(size))
 except (ValueError,UnicodeDecodeError):raise APIError(400,'invalid_json','请求内容无效。')
 if not isinstance(p,dict):raise APIError(400,'invalid_json','需要对象。')
 if path=='/api/campus/session':
  u=next((u for u in USERS if u['id']==p.get('user_id')),None)
  if not u:raise APIError(400,'invalid_user','身份不存在。')
  token=secrets.token_urlsafe(32);now=time.time()
  previous=SimpleCookie()
  try:previous.load(h.headers.get('Cookie',''))
  except Exception:pass
  with h.server.session_lock:
   h.server.campus_sessions={k:v for k,v in h.server.campus_sessions.items() if v[1]>now}
   if previous.get('campus_session'):h.server.campus_sessions.pop(previous['campus_session'].value,None)
   if len(h.server.campus_sessions)>=512:h.server.campus_sessions.pop(next(iter(h.server.campus_sessions)))
   h.server.campus_sessions[token]=(u['id'],now+14400)
  h.reply(200,{'user':u},cookie=f'campus_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=14400');return
 if path=='/api/campus/logout':
  cookies=SimpleCookie()
  try:cookies.load(h.headers.get('Cookie',''))
  except Exception:pass
  token=cookies.get('campus_session')
  with h.server.session_lock:h.server.campus_sessions.pop(token.value if token else '',None)
  h.reply(200,{'signed_out':True},cookie='campus_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return
 if path=='/api/campus/preferences':
  u=account(h)
  if set(p)-{'density','landing','pinned','read_events'}:raise APIError(400,'invalid_preference','包含不支持的设置。')
  if 'density' in p and p['density'] not in ['comfortable','compact']:raise APIError(400,'invalid_preference','显示密度无效。')
  if 'landing' in p and p['landing'] not in ['home','inbox','courses','calendar']:raise APIError(400,'invalid_preference','默认页面无效。')
  _,data=read(h.server);allowed={x['id'] for x in visible(data,u)['courses']}
  if 'pinned' in p and (not isinstance(p['pinned'],list) or len(p['pinned'])>20 or any(not isinstance(x,str) or x not in allowed for x in p['pinned'])):raise APIError(400,'invalid_preference','只能收藏当前身份可见的课程。')
  audit_ids={a['id'] for a in visible(data,u)['audit']}
  if 'read_events' in p and (not isinstance(p['read_events'],list) or len(p['read_events'])>100 or any(not isinstance(x,str) or x not in audit_ids for x in p['read_events'])):raise APIError(400,'invalid_preference','动态读取标记无效。')
  with connection(h.server) as c:
   c.execute('BEGIN IMMEDIATE');row=c.execute('SELECT payload FROM campus_preferences WHERE user_id=?',(u['id'],)).fetchone()
   current=json.loads(row[0]) if row else {'density':'comfortable','landing':'home','pinned':[],'read_events':[]}
   current.update(p)
   for k in ['pinned','read_events']:current[k]=list(dict.fromkeys(current[k]))
   c.execute('INSERT INTO campus_preferences(user_id,payload) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload',(u['id'],json.dumps(current,ensure_ascii=False)))
  h.reply(200,current);return
 if path!='/api/campus/action':raise APIError(404,'not_found','接口不存在。')
 u=account(h)
 with connection(h.server) as c:
  c.execute('BEGIN IMMEDIATE');version,raw=c.execute('SELECT version,payload FROM campus_state WHERE id=1').fetchone();d=json.loads(raw)
  if type(p.get('version')) is not int or p['version']!=version:raise APIError(409,'stale_state','资料已被更新，请刷新后重新操作；输入内容仍保留在表单中。')
  action=p.get('action');cid=p.get('course_id');course=next((x for x in d['courses'] if x['id']==cid),None)
  if not course:raise APIError(404,'course_missing','开课单元不存在。')
  teacher=u['role']=='teacher' and u['id'] in course['teachers']
  if action=='prepare':
   if not teacher:raise APIError(403,'forbidden','只有本课教师可更新备课状态。')
   if type(p.get('prepared')) is not bool:raise APIError(400,'invalid_field','备课状态无效。')
   if p['prepared'] and not any(r['course_id']==cid and r['kind']=='课前材料' for r in d['resources']):raise APIError(400,'missing_material','请先补齐课前材料，再确认备课完成。')
   course['prepared']=p['prepared'];label='确认备课完成' if p['prepared'] else '重新打开备课'
  elif action=='resource_add':
   if not teacher:raise APIError(403,'forbidden','只有本课教师可发布资料。')
   kind=p.get('kind')
   if kind not in ['教学大纲','课前材料','课堂练习']:raise APIError(400,'invalid_kind','资料类型无效。')
   d['resources'].append({'id':'RS-'+secrets.token_hex(5),'course_id':cid,'title':text(p,'title',2,80),'kind':kind,'body':text(p,'body',20,12000),'source':source_input(p),'created':ASOF,'author':u['id']});label='发布课程资料'
  elif action=='resource_update':
   if not teacher:raise APIError(403,'forbidden','只有本课教师可修改资料。')
   resource=next((r for r in d['resources'] if r['id']==p.get('resource_id') and r['course_id']==cid),None)
   if not resource:raise APIError(404,'resource_missing','资料不存在或不属于此开课。')
   title=text(p,'title',2,80);body=text(p,'body',20,12000)
   source=source_input(p) if 'source' in p else material_source(resource)
   if title==resource['title'] and body==resource['body'] and source==material_source(resource):raise APIError(400,'unchanged','资料内容未发生变化。')
   previous={k:resource.get(k) for k in ['title','body','author','created','updated','revision']};previous['source']=material_source(resource)
   resource.setdefault('history',[]).append(previous)
   resource.update(title=title,body=body,source=source,author=u['id'],revision=resource.get('revision',1)+1,updated=datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds'))
   label='更新课程资料'
  elif action=='observation_create':
   if u['role']!='director':raise APIError(403,'forbidden','只有主任可安排听课。')
   dt=text(p,'date',10,10)
   try:parsed=date.fromisoformat(dt)
   except ValueError:raise APIError(400,'invalid_date','请选择有效听课日期。')
   if dt<ASOF or dt>'2026-12-25':raise APIError(400,'invalid_date','请选择场景当前日期至学期结束之间的日期。')
   if parsed.weekday()!=course['day']:raise APIError(400,'schedule_mismatch','听课日期须与本课常规上课星期一致。')
   if any(t['course_id']==cid and t['date']==dt for t in d['tasks']):raise APIError(409,'duplicate_task','该开课在此日期已有听课任务。')
   if any(t['observer']=='s1' and t['date']==dt and next(x for x in d['courses'] if x['id']==t['course_id'])['slot']==course['slot'] for t in d['tasks']):raise APIError(409,'observer_conflict','督导在此时段已有其他听课任务，请选择其他日期。')
   d['tasks'].append({'id':'OB-'+secrets.token_hex(5),'course_id':cid,'observer':'s1','date':dt,'status':'planned','report':{}});label='安排听课任务'
  elif action in ['report_save','report_submit']:
   task=next((t for t in d['tasks'] if t['id']==p.get('task_id') and t['course_id']==cid),None)
   if u['role']!='supervisor' or not task or task['observer']!=u['id']:raise APIError(403,'forbidden','只能填写分配给自己的听课任务。')
   if task['status']=='submitted':raise APIError(409,'already_submitted','听课记录已提交，不能重复修改。')
   if action=='report_submit' and task['date']>ASOF:raise APIError(400,'future_task','尚未到听课日期，可先保存草稿。')
   minimum=10 if action=='report_submit' else 0
   task['report']={k:text(p,k,minimum,2000) for k in ['organization','content','interaction','suggestion']};task['status']='submitted' if action=='report_submit' else 'draft';label='提交听课记录' if action=='report_submit' else '保存听课草稿'
  elif action=='followup_create':
   if u['role']!='director':raise APIError(403,'forbidden','只有主任可发起跟进。')
   due=text(p,'due',10,10)
   try:due=date.fromisoformat(due).isoformat()
   except ValueError:raise APIError(400,'invalid_date','请选择有效日期。')
   if due<ASOF:raise APIError(400,'invalid_date','截止日期不能早于场景当前日期。')
   d['followups'].append({'id':'FU-'+secrets.token_hex(5),'course_id':cid,'title':text(p,'title',2,80),'description':text(p,'description',10,2000),'due':due,'status':'open','reply':'','created':ASOF});label='发起教学跟进'
  elif action in ['followup_reply','followup_close']:
   f=next((x for x in d['followups'] if x['id']==p.get('followup_id') and x['course_id']==cid),None)
   if not f:raise APIError(404,'followup_missing','跟进事项不存在。')
   if action=='followup_reply':
    if not teacher:raise APIError(403,'forbidden','只有本课教师可回复。')
    if f['status']!='open':raise APIError(409,'invalid_state','该事项不处于待回复状态。')
    f['reply']=text(p,'reply',10,2000);f['status']='replied';label='回复教学跟进'
   else:
    if u['role']!='director':raise APIError(403,'forbidden','只有主任可复核关闭。')
    if f['status']!='replied':raise APIError(409,'invalid_state','须先收到教师回复才能关闭。')
    f['resolution']=text(p,'resolution',10,2000);f['status']='closed';label='复核关闭教学跟进'
  else:raise APIError(400,'invalid_action','不支持此操作。')
  d['audit'].append({'id':secrets.token_hex(6),'course_id':cid,'actor':u['name'],'action':label,'at':datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds')})
  c.execute('UPDATE campus_state SET version=?,payload=? WHERE id=1',(version+1,json.dumps(d,ensure_ascii=False)))
 h.reply(200,{'version':version+1,'data':visible(d,u),'user':u,'users':USERS})
