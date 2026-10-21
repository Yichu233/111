"""Regression checks for original course/source requirements, using isolated data."""
import unittest
import test_campus as helpers
from app import campus

class CourseEvidenceTests(unittest.TestCase):
 setUp=helpers.CampusTests.setUp
 tearDown=helpers.CampusTests.tearDown
 call=helpers.CampusTests.call
 login=helpers.CampusTests.login
 state=helpers.CampusTests.state
 act=helpers.CampusTests.act

 def test_course_level_introduction_shared_without_claiming_official_code(self):
  self.login('d1');d=self.state('d1')['data'];a,b=[c for c in d['courses'] if c['name']=='软件项目管理']
  self.assertEqual(a['course_information'],b['course_information'])
  self.assertIn('范围与需求',a['course_information']['introduction'])
  self.assertIsNone(a['course_information']['code'])
  self.assertIn('非学校官方',a['course_information']['source'])
  self.assertNotEqual(a['topic'],a['course_information']['introduction'])

 def test_old_database_enrichment_does_not_write_or_reset_scene(self):
  self.login('t1');version,before=campus.read(self.server);self.state('t1');after_version,after=campus.read(self.server)
  self.assertEqual((version,before),(after_version,after))
  self.assertNotIn('course_information',after['courses'][0])

 def test_existing_scope_and_provenance_do_not_expand_teacher_access(self):
  self.login('t1');d=self.state('t1')['data'];allowed={c['id'] for c in d['courses']}
  self.assertTrue(d['resources'])
  for r in d['resources']:
   self.assertIn(r['course_id'],allowed);self.assertEqual(r['scope'],'offering')
   self.assertIn('场景编写',r['source'])
  self.assertNotIn('CL-02',allowed)

 def test_missing_source_is_unknown_instead_of_author_or_date(self):
  self.login('t1');code,state=self.act('t1','resource_add','CL-04',title='没有提供出处的材料',kind='课前材料',body='该资料用于检查未提供来源时仍能保留正文，但不能将作者或日期推断为来源。')
  self.assertEqual(code,200);r=state['data']['resources'][-1]
  self.assertIsNone(r['source']);self.assertEqual(r['scope'],'offering')

 def test_source_only_revision_preserves_old_source_and_body(self):
  self.login('t1');old=self.state('t1')['data']['resources'][0]
  code,state=self.act('t1','resource_update',old['course_id'],resource_id=old['id'],title=old['title'],body=old['body'],source='本组课程资料整理，2026年10月21日登记。')
  self.assertEqual(code,200);new=next(r for r in state['data']['resources'] if r['id']==old['id'])
  self.assertEqual(new['revision'],2);self.assertEqual(new['body'],old['body'])
  self.assertEqual(new['history'][0]['source'],old['source'])
  self.assertEqual(self.state('t1')['data']['resources'][0]['source'],new['source'])

 def test_source_validation_is_atomic_and_director_cannot_write(self):
  self.login('t1');before=self.state('t1');old=before['data']['resources'][0]
  for source in [1,'x'*501]:
   code,_=self.act('t1','resource_update',old['course_id'],resource_id=old['id'],title=old['title'],body=old['body'],source=source)
   self.assertEqual(code,400);self.assertEqual(self.state('t1')['version'],before['version'])
  self.login('d1')
  self.assertEqual(self.act('d1','resource_update',old['course_id'],resource_id=old['id'],title=old['title'],body=old['body'],source='不允许主任代替教师修改来源。')[0],403)

if __name__=='__main__':unittest.main()
