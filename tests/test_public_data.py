import unittest,json,hashlib
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
class Rows(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None
 def handle_starttag(self,t,a):
  if t=='tr':self.row=[]
  if t in ('td','th'):self.cell=[]
 def handle_data(self,d):
  if self.cell is not None:self.cell.append(d)
 def handle_endtag(self,t):
  if t in ('td','th') and self.cell is not None:
   if self.row is not None:self.row.append(' '.join(''.join(self.cell).split()))
   self.cell=None
  if t=='tr' and self.row is not None:self.rows.append(self.row);self.row=None
class PublicDataTests(unittest.TestCase):
 def setUp(self):self.data=json.loads((ROOT/'app/public_catalog.json').read_text('utf-8'))
 def test_snapshots_match_manifest_hashes(self):
  for s in self.data['sources']:self.assertEqual(hashlib.sha256((ROOT/'docs/public-data'/s['file']).read_bytes()).hexdigest(),s['sha256'])
 def test_every_course_field_matches_original_row(self):
  p=Rows();p.feed((ROOT/'docs/public-data/honors.html').read_text('utf-8'))
  rows=[r for r in p.rows if len(r)==6 and r[0].isdigit()]
  self.assertEqual(len(rows),len(self.data['items']))
  for c in self.data['items']:self.assertEqual([c[k] for k in ['source_sequence','name','leader','kind','department','batch']],p.rows[c['source_row']-1])
 def test_all_online_records_are_in_2018_section_and_links_are_exact_matches(self):
  p=Rows();p.feed((ROOT/'docs/public-data/courses.html').read_text('utf-8'));active=False;rows=[]
  for r in p.rows:
   if len(r)==1:active='2018年国家级在线开放课程' in r[0]
   if active and len(r)==6 and r[0].isdigit():rows.append(r)
  self.assertEqual(len(rows),len(self.data['resources']))
  for c in self.data['resources']:
   r=p.rows[c['source_row']-1];self.assertIn(r,rows);self.assertEqual([c[k] for k in ['name','leader','school','platform']],[r[1],r[2],r[4],r[5]])
  for c in self.data['items']:
   for rid in c['resources']:
    r=next(x for x in self.data['resources'] if x['id']==rid);self.assertEqual((c['name'],c['leader']),(r['name'],r['leader']))
if __name__=='__main__':unittest.main()
