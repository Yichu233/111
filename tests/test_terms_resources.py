"""Original-story regression: term isolation, shared resources and legacy safety.

Historical records below are isolated test fixtures, not school or shipped data.
"""
import copy
import json
import unittest
import test_campus as helpers
from app import campus


class TermResourceTests(unittest.TestCase):
    setUp = helpers.CampusTests.setUp
    tearDown = helpers.CampusTests.tearDown
    call = helpers.CampusTests.call
    login = helpers.CampusTests.login
    state = helpers.CampusTests.state
    act = helpers.CampusTests.act

    def add_shared(self, scope='course'):
        self.login('t1')
        code, response = self.act('t1', 'resource_add', 'CL-01', scope=scope,
            title='同课程共用教学资料', kind='课前材料',
            body='本资料为隔离测试专用，核验同课程跨教学班可见、不同课程与学期隔离。', source='隔离测试编写')
        self.assertEqual(code, 200)
        return response['data']['resources'][-1]

    def history_fixture(self):
        with campus.connection(self.server) as conn:
            version, raw = conn.execute('SELECT version,payload FROM campus_state WHERE id=1').fetchone()
            data = json.loads(raw)
            historical = copy.deepcopy(data['courses'][0])
            historical.update(id='H-01', term_id='2026-spring', teachers=['t1'], class_name='历史隔离测试班')
            data['courses'].append(historical)
            resource = copy.deepcopy(data['resources'][0])
            resource.update(id='HR-01', course_id='H-01', title='历史学期资料')
            data['resources'].append(resource)
            data['tasks'].append({'id':'HT-01','course_id':'H-01','observer':'s1',
                'date':'2026-05-20','status':'submitted','report':{'organization':'隔离测试历史记录'}})
            conn.execute('UPDATE campus_state SET payload=? WHERE id=1',(json.dumps(data, ensure_ascii=False),))

    def test_default_and_empty_terms_do_not_rewrite_existing_database(self):
        self.login('t1')
        before = campus.read(self.server)
        self.assertEqual(len(self.state('t1')['data']['courses']), 3)
        code, response = self.call('t1','state?term_id=2027-spring')
        self.assertEqual(code,200)
        for key in ['courses','resources','tasks','followups','audit']:
            self.assertEqual(response['data'][key],[])
        self.assertEqual(before,campus.read(self.server))

    def test_populated_historical_term_is_isolated_for_all_roles(self):
        self.history_fixture()
        for actor in ['t1','d1','s1']:
            self.login(actor)
            code, response = self.call(actor,'state?term_id=2026-spring')
            self.assertEqual(code,200)
            self.assertEqual([c['id'] for c in response['data']['courses']],['H-01'])
            self.assertEqual([r['id'] for r in response['data']['resources']],['HR-01'])
            self.assertEqual([t['id'] for t in response['data']['tasks']],['HT-01'])
            self.assertNotIn('H-01',[c['id'] for c in self.state(actor)['data']['courses']])
        self.login('t2')
        self.assertEqual(self.call('t2','state?term_id=2026-spring')[1]['data']['courses'],[])

    def test_invalid_or_duplicate_term_is_rejected(self):
        self.login('d1')
        for query in ['unknown','','2026-autumn&term_id=2026-spring']:
            self.assertEqual(self.call('d1','state?term_id='+query)[0],400)

    def test_wrong_term_and_historical_writes_are_rejected_atomically(self):
        self.history_fixture(); self.login('t1'); before=campus.read(self.server)
        self.assertEqual(self.act('t1','prepare','CL-01',term_id='2026-spring',prepared=True)[0],409)
        self.assertEqual(self.act('t1','prepare','H-01',term_id='2026-spring',prepared=True)[0],403)
        self.assertEqual(before,campus.read(self.server))

    def test_shared_read_scope_and_publisher_only_edit(self):
        shared=self.add_shared()
        self.assertEqual(shared['offering_ids'],['CL-01'])  # t1 cannot see CL-02.
        for actor in ['t2','d1','s1']:
            self.login(actor)
            matching=[r for r in self.state(actor)['data']['resources'] if r['id']==shared['id']]
            self.assertEqual(len(matching),1)
            self.assertEqual(matching[0]['offering_ids'],['CL-01','CL-02'])
            self.assertFalse(matching[0]['can_edit'])
        self.assertEqual(self.act('t2','resource_update','CL-02',resource_id=shared['id'],
            title=shared['title'],body=shared['body'],source='越权修改')[0],403)
        self.login('t3')
        self.assertNotIn(shared['id'],[r['id'] for r in self.state('t3')['data']['resources']])

    def test_shared_resource_does_not_leak_into_same_course_other_term(self):
        shared=self.add_shared();self.history_fixture()
        response=self.call('t1','state?term_id=2026-spring')[1]
        self.assertNotIn(shared['id'],[r['id'] for r in response['data']['resources']])

    def test_scope_change_preserves_history_and_private_scope(self):
        private=self.add_shared('offering')
        code,response=self.act('t1','resource_update','CL-01',resource_id=private['id'],
            title=private['title'],body=private['body'],scope='course')
        self.assertEqual(code,200)
        updated=next(r for r in response['data']['resources'] if r['id']==private['id'])
        self.assertEqual(updated['history'][-1]['scope'],'offering')
        self.assertEqual(updated['revision'],2)
        self.act('t1','resource_update','CL-01',resource_id=private['id'],title=private['title'],body=private['body'],scope='offering')
        self.login('t2')
        # t2 teaches both CL-01 and CL-02; the private item stays CL-01 only.
        r=next(r for r in self.state('t2')['data']['resources'] if r['id']==private['id'])
        self.assertEqual(r['offering_ids'],['CL-01'])
        self.assertEqual(r['history'][-1]['scope'],'course')

    def test_invalid_scope_and_unrelated_course_cannot_change_material(self):
        shared=self.add_shared();before=campus.read(self.server)
        self.assertEqual(self.act('t1','resource_update','CL-01',resource_id=shared['id'],title=shared['title'],body=shared['body'],scope='school')[0],400)
        self.assertEqual(self.act('t1','resource_update','CL-03',resource_id=shared['id'],title=shared['title'],body=shared['body'],scope='course')[0],404)
        self.assertEqual(before,campus.read(self.server))

    def test_shared_preparation_and_narrowing_reopen_affected_class(self):
        shared=self.add_shared()
        with campus.connection(self.server) as conn:
            version,raw=conn.execute('SELECT version,payload FROM campus_state WHERE id=1').fetchone()
            data=json.loads(raw)
            data['resources']=[r for r in data['resources'] if not(r['course_id']=='CL-02' and r['kind']=='课前材料')]
            conn.execute('UPDATE campus_state SET payload=? WHERE id=1',(json.dumps(data),))
        self.login('t2')
        self.assertEqual(self.act('t2','prepare','CL-02',prepared=True)[0],200)
        self.assertEqual(self.act('t1','resource_update','CL-01',resource_id=shared['id'],title=shared['title'],body=shared['body'],scope='offering')[0],200)
        self.assertFalse(next(c for c in self.state('t2')['data']['courses'] if c['id']=='CL-02')['prepared'])


if __name__=='__main__':unittest.main()
