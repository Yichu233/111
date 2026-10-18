const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),base=process.env.AIJIAOXUE_BASE_URL||'http://127.0.0.1:18772',checks=[],errors=[];
 page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));
 async function ready(){await page.waitForFunction(()=>document.querySelector('#page').getAttribute('aria-busy')==='false');if(await page.locator('.portal-entry').count()){await page.getByRole('button',{name:'进入教学工作空间',exact:true}).click();await page.locator('.teacher-layout').waitFor();}await page.waitForFunction(()=>!document.querySelector('#identity').disabled);}
 async function go(route){await page.goto(base+'/#/'+route);await ready();}
 async function role(id){await page.selectOption('#identity',id);await ready();}
 async function test(name,work){await work();checks.push(name);console.log('PASS '+name);}
 try{
  await go('home');
  await test('course query and filter survive detail tabs, selector and return',async()=>{
   await role('t1');await go('courses?q=软件&filter=unprepared');
   const count=await page.locator('tbody tr').count();assert(count>0);
   await page.locator('tbody .table-title').first().click();await page.locator('.course-hero').waitFor();
   assert.equal(await page.locator('#nav [aria-current]').innerText(),'任课课程');
   await page.getByRole('link',{name:'教学资料',exact:true}).click();
   await page.getByLabel('切换开课单元').selectOption('CL-03');
   await page.waitForURL(/course\/CL-03/);
   await page.getByRole('link',{name:'返回开课列表',exact:true}).click();
   await page.waitForURL(/courses\?q=/);
   assert.equal(await page.getByRole('searchbox').inputValue(),'软件');
   assert.equal(await page.getByLabel('开课状态').inputValue(),'unprepared');
   assert.equal(await page.locator('tbody tr').count(),count);
  });
  await test('calendar week is deep linked and home is always current scene week',async()=>{
   await go('calendar?week=1');assert.match(await page.locator('.calendar-range').innerText(),/10-19/);
   await page.reload();await ready();assert.match(await page.locator('.calendar-range').innerText(),/10-19/);
   await page.locator('.week-lesson').first().click();await page.locator('.course-hero').waitFor();
   await page.getByRole('link',{name:'返回周历',exact:true}).click();await page.waitForURL(/calendar\?week=1/);
   await page.getByRole('link',{name:'我的教学',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.hero-copy')&&document.querySelector('.week-strip').textContent.includes('10-12'));assert.match(await page.locator('.week-strip').innerText(),/10-12/);
  });
  await test('supervisor draft survives course reading, return, reload and role switch',async()=>{
   await role('s1');await go('observations/OB-04');
   await page.getByLabel('教学组织',{exact:true}).fill('尚未保存的课堂观察：需要保留返回任务时的输入内容。');
   assert.match(await page.locator('.draft-status').innerText(),/尚未保存到服务器/);
   await page.getByRole('link',{name:'查阅课程材料'}).click();await page.locator('.course-hero').waitFor();
   assert.equal(await page.locator('#nav [aria-current]').innerText(),'听课任务');
   await page.getByRole('link',{name:'返回听课任务'}).click();await page.locator('.observation-form').waitFor();
   assert.match(await page.getByLabel('教学组织',{exact:true}).inputValue(),/尚未保存/);
   await page.reload();await ready();assert.match(await page.getByLabel('教学组织',{exact:true}).inputValue(),/尚未保存/);
   await role('t1');assert.equal(await page.locator('.observation-form').count(),0);
   await role('s1');await go('observations/OB-04');assert.match(await page.getByLabel('教学组织',{exact:true}).inputValue(),/尚未保存/);
  });
  await test('offline save preserves input and re-enables controls',async()=>{
   await page.route('**/api/campus/action',route=>route.abort('failed'));
   await page.getByRole('button',{name:'保存草稿',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.form-error').textContent.length>0);
   assert.match(await page.getByLabel('教学组织',{exact:true}).inputValue(),/尚未保存/);
   assert(!(await page.getByRole('button',{name:'保存草稿',exact:true}).isDisabled()));
   await page.unroute('**/api/campus/action');
  });
  await test('stale version refresh keeps draft and allows safe server save',async()=>{
   await page.evaluate(async()=>{const state=await(await fetch('/api/campus/state')).json();await fetch('/api/campus/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'report_save',version:state.version,course_id:'CL-02',task_id:'OB-04',organization:'另一个窗口的草稿内容用于校验并发修改。',content:'',interaction:'',suggestion:''})});});
   await page.getByRole('button',{name:'保存草稿',exact:true}).click();
   await page.getByRole('button',{name:'刷新状态并保留草稿'}).waitFor();
   assert.match(await page.getByLabel('教学组织',{exact:true}).inputValue(),/尚未保存/);
   await page.getByRole('button',{name:'刷新状态并保留草稿'}).click();
   await page.waitForFunction(()=>document.querySelector('.form-error').textContent.includes('已读取'));
   await page.getByRole('button',{name:'保存草稿',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.draft-status').textContent.includes('服务器草稿'));
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('aijiaoxue:observation:s1:OB-04')),null);
  });
  await test('field validation places keyboard focus on the first incomplete field',async()=>{
   await page.getByRole('button',{name:'提交听课记录'}).click();
   assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'内容呈现');
   assert.equal(await page.locator('[aria-invalid=true]').count(),3);
  });
  await test('searching a material opens that exact document directly',async()=>{
   await role('t1');await page.getByRole('button',{name:'搜索课程与资料',exact:true}).click();
   await page.getByRole('searchbox').fill('需求边界场景教学材料');
   await page.locator('.search-result').click();
   await page.locator('.document-body').waitFor();assert.match(await page.locator('.document-body').innerText(),/三[个种]场景|三个场景|边界|前置条件/);
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  });
  await test('dirty modal closure requires explicit discard and preserves input on resume',async()=>{
   await go('course/CL-04/materials');await page.getByRole('button',{name:'新建课程资料'}).click();
   await page.getByLabel('资料标题').fill('尚未发布的资料');await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'继续编辑'}).click();assert.equal(await page.getByLabel('资料标题').inputValue(),'尚未发布的资料');
   await page.getByRole('button',{name:'关闭',exact:true}).click();await page.getByRole('button',{name:'放弃未提交内容'}).click();
   await page.waitForFunction(()=>!document.querySelector('dialog'));assert.equal(await page.locator('dialog').count(),0);
  });
  await test('director metric links and followup links open the intended subset',async()=>{
   await role('d1');await page.locator('.metric').filter({hasText:'资料待补'}).click();await page.waitForURL(/filter=missing/);
   assert.equal(await page.getByLabel('开课状态').inputValue(),'missing');
   await go('followups?status=active');assert.equal(await page.locator('.follow-card').filter({hasText:'已关闭'}).count(),0);
   await go('followups/FU-02');assert.equal(await page.locator('.selected-followup').getAttribute('id'),'FU-02');
  });
  await test('invalid routes and inaccessible records never show unrelated content',async()=>{
   for(const route of ['unknown','course/CL-01/wrong','followups/none']){await go(route);await page.getByRole('link',{name:'返回工作台',exact:true}).waitFor();}
   await role('s1');await go('observations/not-a-task');assert.equal(await page.locator('.observation-form').count(),0);assert.match(await page.locator('#page').innerText(),/不可访问/);
  });
  await test('all visible desktop pages have named controls and no horizontal overflow',async()=>{
   for(const width of [1100,1440,1920]){
    await page.setViewportSize({width,height:1000});
    for(const id of ['t1','d1','s1']){
     await role(id);
     for(const route of ['home','courses','course/CL-01','course/CL-01/materials','course/CL-01/feedback','calendar','followups',...(id==='d1'?['quality']:id==='s1'?['observations/OB-04']:['resources'])]){
      await go(route);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id+' '+route+' '+width);
      const unnamed=await page.locator('#page button, #page a').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()&&!n.getAttribute('aria-label')).length);assert.equal(unnamed,0,route);
     }
    }
   }
  });
  assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/campus/polish-results.json',JSON.stringify({passed:checks.length,checks,errors},null,2));
  console.log('ALL PASS '+checks.length);
 }catch(e){await page.screenshot({path:'artifacts/campus/polish-failure.png',fullPage:true});throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
