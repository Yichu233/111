import unittest,tempfile,threading,json,urllib.request,urllib.error,http.cookiejar
from pathlib import Path
from app.server import AppServer
from app import campus
class CampusTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.server=AppServer(('127.0.0.1',0),database=Path(self.tmp.name)/'legacy.sqlite3');self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start();self.base='http://127.0.0.1:'+str(self.server.server_port);self.clients={}
 def tearDown(self):self.server.shutdown();self.server.server_close();self.thread.join();self.tmp.cleanup()
 def call(self,user,path,payload=None):
  if user not in self.clients:self.clients[user]=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
  req=urllib.request.Request(self.base+'/api/campus/'+path,data=json.dumps(payload).encode() if payload is not None else None,headers={'Content-Type':'application/json','Origin':self.base})
  try:
   with self.clients[user].open(req,timeout=5) as r:return r.status,json.load(r)
  except urllib.error.HTTPError as e:return e.code,json.load(e)
 def login(self,user):self.assertEqual(self.call(user,'session',{'user_id':user})[0],200)
 def state(self,user):return self.call(user,'state')[1]
 def act(self,user,action,cid,**kw):return self.call(user,'action',{'version':self.state(user)['version'],'action':action,'course_id':cid,**kw})
 def test_source_separation_and_relational_integrity(self):
  d=campus.seed();catalog=json.loads((campus.ROOT/'public_catalog.json').read_text('utf-8'));facts={c['id']:c for c in catalog['items']};self.assertEqual(d['mode'],'scenario');self.assertEqual(len(d['courses']),12)
  for c in d['courses']:self.assertEqual(c['name'],facts[c['catalog_id']]['name']);self.assertEqual(len(c['teachers']),len(set(c['teachers'])))
  self.assertEqual(sum(c['id']=='CL-01' for c in d['courses']),1)
  for t in d['tasks']:
   c=next(c for c in d['courses'] if c['id']==t['course_id']);self.assertEqual(campus.date.fromisoformat(t['date']).weekday(),c['day'])
 def test_sessions_and_teacher_scope(self):
  self.assertEqual(self.call('anonymous','state')[0],401);self.login('t1');d=self.state('t1')['data'];self.assertEqual({c['id'] for c in d['courses']},{'CL-01','CL-03','CL-04'});self.assertTrue(all(t['status']=='submitted' for t in d['tasks']));self.assertEqual(self.act('t1','prepare','CL-02',prepared=True)[0],403)
 def test_teacher_resource_and_preparation_persist(self):
  self.login('t1');self.assertEqual(self.act('t1','prepare','CL-04',prepared=True)[0],400)
  status,d=self.act('t1','resource_add','CL-04',title='场景需求讨论材料',kind='课前材料',body='这是一份用于验证需求讨论教学流程的场景材料，包含目标、练习和总结。');self.assertEqual(status,200);self.assertEqual(self.act('t1','prepare','CL-04',prepared=True)[0],200)
  version,state=campus.read(self.server);self.assertTrue(next(c for c in state['courses'] if c['id']=='CL-04')['prepared']);self.assertEqual(len(state['audit']),2)
 def test_role_permissions_and_optimistic_concurrency(self):
  self.login('s1');self.assertEqual(self.act('s1','resource_add','CL-04',title='越权资料',kind='课前材料',body='这是不允许督导发布到任课课程中的教学资料正文。')[0],403)
  self.login('t1');v=self.state('t1')['version'];self.assertEqual(self.act('t1','prepare','CL-01',prepared=True)[0],200);self.assertEqual(self.call('t1','action',{'action':'prepare','course_id':'CL-01','prepared':False,'version':v})[0],409)
 def test_followup_lifecycle_requires_teacher_then_director(self):
  for u in ['d1','t1','t2']:self.login(u)
  status,d=self.act('d1','followup_create','CL-04',title='补充场景边界分析',description='请增加无匹配、无权限以及数据未知三种边界场景。',due='2026-10-19');self.assertEqual(status,200);f=d['data']['followups'][-1]
  self.assertEqual(self.act('d1','followup_close','CL-04',followup_id=f['id'],resolution='已经核对全部材料，并确认符合本轮要求。')[0],409)
  self.assertEqual(self.act('t2','followup_reply','CL-04',followup_id=f['id'],reply='已经完成三种场景的分析和验证材料。')[0],403)
  self.assertEqual(self.act('t1','followup_reply','CL-04',followup_id=f['id'],reply='已经完成三种场景的分析和验证材料。')[0],200)
  self.assertEqual(self.act('d1','followup_close','CL-04',followup_id=f['id'],resolution='已经核对三种场景对应的材料，满足本轮要求。')[0],200)
  self.assertEqual(self.act('t1','followup_reply','CL-04',followup_id=f['id'],reply='不允许重复回复已经关闭的跟进事项。')[0],409)
 def test_observation_draft_submit_visibility_and_future_guard(self):
  for u in ['s1','t1']:self.login(u)
  fields={k:'已记录课堂教学的具体事实，说明依据并给出可执行的建议。' for k in ['organization','content','interaction','suggestion']}
  self.assertEqual(self.act('s1','report_save','CL-04',task_id='OB-03',**fields)[0],200);self.assertNotIn('OB-03',[t['id'] for t in self.state('t1')['data']['tasks']]);self.assertEqual(self.act('s1','report_submit','CL-04',task_id='OB-03',**fields)[0],200);self.assertIn('OB-03',[t['id'] for t in self.state('t1')['data']['tasks']]);self.assertEqual(self.act('s1','report_submit','CL-04',task_id='OB-03',**fields)[0],409)
  self.assertEqual(self.act('s1','report_submit','CL-06',task_id='OB-05',**fields)[0],400)
 def test_scheduling_date_duplicate_and_observer_collision(self):
  self.login('d1');self.assertEqual(self.act('d1','observation_create','CL-01',date='2026-10-19')[0],400);self.assertEqual(self.act('d1','observation_create','CL-01',date='2026-10-21')[0],200);self.assertEqual(self.act('d1','observation_create','CL-01',date='2026-10-21')[0],409)
  self.login('t1');self.assertEqual(self.act('t1','observation_create','CL-01',date='2026-10-28')[0],403)
 def test_input_validation_and_atomic_failure(self):
  self.login('d1');v=self.state('d1')['version'];self.assertEqual(self.act('d1','followup_create','CL-04',title='缺失描述',description='短',due='2026-10-19')[0],400);self.assertEqual(self.state('d1')['version'],v)
  self.assertEqual(self.act('d1','followup_create','CL-04',title='错误日期',description='此事项用于验证早于场景日期时不能发起。',due='2026-10-14')[0],400)
if __name__=='__main__':unittest.main()
