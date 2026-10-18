import unittest
import test_campus as helpers

class WorkspaceTests(unittest.TestCase):
 setUp=helpers.CampusTests.setUp
 tearDown=helpers.CampusTests.tearDown
 call=helpers.CampusTests.call
 login=helpers.CampusTests.login
 state=helpers.CampusTests.state
 act=helpers.CampusTests.act
 def test_personal_preferences_persist_and_are_user_scoped(self):
  self.login('t1');version=self.state('t1')['version']
  code,prefs=self.call('t1','preferences',{'density':'compact','landing':'inbox','pinned':['CL-01','CL-01']})
  self.assertEqual(code,200);self.assertEqual(prefs['pinned'],['CL-01']);self.assertEqual(self.state('t1')['version'],version)
  self.assertEqual(self.call('t1','preferences')[1]['landing'],'inbox');self.login('t2');self.assertEqual(self.call('t2','preferences')[1]['pinned'],[])
  self.assertEqual(self.call('t1','preferences',{'pinned':['CL-02']})[0],400)
  self.assertEqual(self.call('t1','preferences',{'density':'tiny'})[0],400)
  self.assertEqual(self.call('t1','preferences',{'read_events':['unknown']})[0],400)
  self.assertEqual(self.call('anonymous','preferences')[0],401)
 def test_material_revision_preserves_old_content_and_permissions(self):
  self.login('t1');original=self.state('t1')['data']['resources'][0]
  code,state=self.act('t1','resource_update',original['course_id'],resource_id=original['id'],title='课堂讨论材料修订',body='本次补充课堂讨论的分组方式、记录模板、汇报顺序以及具体的反馈要求。')
  self.assertEqual(code,200);r=next(r for r in state['data']['resources'] if r['id']==original['id'])
  self.assertEqual(r['revision'],2);self.assertEqual(r['history'][0]['body'],original['body']);self.assertEqual(r['kind'],original['kind'])
  self.login('d1');self.assertEqual(self.act('d1','resource_update',r['course_id'],resource_id=r['id'],title='越权修改标题',body='主任不能代替任课教师直接修改课程资料正文内容。')[0],403)
  self.login('t2');self.assertEqual(self.act('t2','resource_update','CL-04',resource_id=r['id'],title='错误课程资料',body='错误课程中的资料不可被其他教师直接编辑修改。')[0],403)
  self.assertEqual(self.act('t1','resource_update',r['course_id'],resource_id=r['id'],title=r['title'],body=r['body'])[0],400)
 def test_draft_activity_is_private_but_submission_is_visible(self):
  for user in ['s1','t1','d1']:self.login(user)
  fields={k:'课堂观察事实完整，包含环节衔接、学生反馈与具体改进建议。' for k in ['organization','content','interaction','suggestion']}
  self.assertEqual(self.act('s1','report_save','CL-04',task_id='OB-03',**fields)[0],200)
  self.assertEqual(len(self.state('s1')['data']['audit']),1)
  for user in ['t1','d1']:self.assertEqual(self.state(user)['data']['audit'],[])
  self.assertEqual(self.act('s1','report_submit','CL-04',task_id='OB-03',**fields)[0],200)
  for user in ['t1','d1']:self.assertEqual([a['action'] for a in self.state(user)['data']['audit']],['提交听课记录'])
 def test_read_mark_changes_neither_workflow_nor_other_identity(self):
  self.login('t1');code,data=self.act('t1','prepare','CL-01',prepared=True);event=data['data']['audit'][-1]['id'];version=data['version']
  self.assertEqual(self.call('t1','preferences',{'read_events':[event]})[0],200)
  self.assertEqual(self.state('t1')['version'],version);self.assertEqual(self.call('t1','preferences')[1]['read_events'],[event])
  self.login('d1');self.assertEqual(self.call('d1','preferences')[1]['read_events'],[])
 def test_logout_revokes_server_session(self):
  self.login('t1');self.assertEqual(self.call('t1','logout',{})[0],200)
  self.assertEqual(self.call('t1','state')[0],401);self.assertIsNone(self.call('t1','bootstrap')[1]['user'])

if __name__=='__main__':unittest.main()
