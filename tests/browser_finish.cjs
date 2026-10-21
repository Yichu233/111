const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1440,height:900}});
 const base=process.env.AIJIAOXUE_BASE_URL,checks=[],errors=[];
 assert(base,'Use the isolated test runner.');page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 async function ready(){await page.waitForFunction(()=>document.querySelector('#page')?.getAttribute('aria-busy')==='false');}
 async function go(route){await page.goto(base+'/#/'+route);await ready();}
 async function role(id){await page.selectOption('#identity',id);await page.waitForFunction(id=>!document.querySelector('#identity').disabled&&document.querySelector('#identity').value===id,id);}
 async function test(name,fn){try{await fn();checks.push(name);console.log('PASS '+name);}catch(e){
  console.error('FAILED '+name,await page.evaluate(()=>({route:location.hash,busy:V.busy,user:V.user,entryRole:W.entryRole,network:document.querySelector('#network').textContent,body:document.querySelector('#page').innerText})));
  await page.screenshot({path:'artifacts/campus/failed-interaction.png',fullPage:true});throw e;
 }}
 try{
  await go('portal');await page.getByRole('button',{name:'进入教学工作空间',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#identity').disabled);await go('home');await page.locator('.teacher-layout').waitFor();
  await test('course sorting is chronological, query survives detail and reset restores scope',async()=>{
   await go('courses');assert.match(await page.locator('tbody tr').first().innerText(),/周一/);
   await page.getByLabel('课程排序').selectOption('name');const expected=(await page.locator('tbody .table-title').allTextContents()).slice().sort((a,b)=>a.localeCompare(b,'zh-CN'));assert.deepEqual(await page.locator('tbody .table-title').allTextContents(),expected);
   await page.getByRole('searchbox').fill('软件');await page.locator('tbody .table-title').first().click();await page.locator('.course-hero').waitFor();await page.getByRole('link',{name:'返回开课列表',exact:true}).click();await page.locator('.filter-surface').waitFor();assert.equal(await page.getByLabel('课程排序').inputValue(),'name');assert.equal(await page.getByRole('searchbox').inputValue(),'软件');await page.getByRole('button',{name:'清除筛选'}).click();await page.waitForURL(/#\/courses$/);assert.equal(await page.locator('tbody tr').count(),3);
  });
  await test('material filters combine with course context and expose only own-course create action',async()=>{
   await go('resources');await page.getByLabel('所属课程',{exact:true}).selectOption('CL-01');await page.getByLabel('资料类型',{exact:true}).selectOption('教学大纲');assert.equal(await page.locator('.resource-row').count(),1);assert.match(await page.locator('.resource-context').innerText(),/软件工程2401/);await page.getByRole('button',{name:'登记课程资料'}).click();await page.getByLabel('资料标题',{exact:true}).waitFor();await page.getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('button',{name:'清除筛选'}).click();await page.waitForURL(/#\/resources$/);assert((await page.locator('.resource-row').count())>1);
  });
  await test('task queue separates today and future based on scene date, preserves URL filter',async()=>{
   await role('s1');await go('inbox');await page.getByRole('button',{name:/^后续安排 /}).click();assert((await page.locator('.inbox-row').count())>0);assert.doesNotMatch(await page.locator('.inbox-list').innerText(),/今天处理/);await page.reload();await ready();assert.equal(await page.getByRole('button',{name:/^后续安排 /}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:/^已过期 /}).click();assert.match(await page.locator('.inbox-list').innerText(),/当前筛选没有事项/);
  });
  await test('calendar due dates follow week navigation and open the exact follow-up',async()=>{
   await role('d1');await go('calendar');assert.match(await page.locator('.deadline-panel').innerText(),/补充路由算法对照表/);await page.locator('.deadline-row').filter({hasText:'补充路由算法对照表'}).click();await page.waitForURL(/followups\/FU-02/);await go('calendar?week=1');assert.match(await page.locator('.deadline-panel').innerText(),/补充小组讨论记录方式/);
  });
  await test('public catalog returns to the same page and filter instead of resetting',async()=>{
   await go('catalog?q=软件');await page.locator('tbody .table-title').first().waitFor();await page.locator('tbody .table-title').first().click();await page.locator('.catalog-detail').waitFor();await page.getByRole('link',{name:'返回课程库',exact:true}).click();await page.getByRole('searchbox').waitFor();assert.equal(await page.getByRole('searchbox').inputValue(),'软件');
   await go('catalog?page=2');await page.locator('tbody .table-title').first().waitFor();const title=await page.locator('tbody .table-title').first().innerText();await page.locator('tbody .table-title').first().click();await page.locator('.catalog-detail').waitFor();await page.getByRole('link',{name:'返回课程库',exact:true}).click();await page.locator('tbody .table-title').first().waitFor();assert.equal(await page.locator('tbody .table-title').first().innerText(),title);assert.match(page.url(),/page=2/);
  });
  await test('course source stays in integrated shell and returns to original course context',async()=>{
   await go('course/CL-01?from=courses');await page.getByRole('link',{name:'查阅公开课程来源'}).click();await page.locator('.catalog-detail').waitFor();assert.match(page.url(),/#\/catalog\//);await page.getByRole('link',{name:'返回开课详情',exact:true}).click();await page.locator('.course-hero').waitFor();assert.match(page.url(),/course\/CL-01/);
  });
  await test('record checklist reflects actual text and index filtering retains selection',async()=>{
   await role('s1');await go('observations/OB-05');assert.match(await page.locator('.record-completion').innerText(),/0 \/ 4/);
   await page.getByLabel('教学组织',{exact:true}).fill('课程准备充分，课堂活动顺序明确。');assert.match(await page.locator('.record-completion').innerText(),/1 \/ 4/);
   await page.getByLabel('任务索引状态').selectOption('pending');assert.equal(await page.locator('.visit-index-item[data-status=submitted]:visible').count(),0);await page.locator('.visit-index-item:visible').last().click();await page.waitForURL(/status=pending/);assert.equal(await page.getByLabel('任务索引状态').inputValue(),'pending');
  });
  await test('follow-up search and phase filter combine without changing records',async()=>{
   await role('d1');await go('followups');await page.getByLabel('跟进状态').selectOption('replied');await page.getByRole('searchbox').fill('路由');assert.equal(await page.locator('.follow-card').count(),1);assert.match(await page.locator('.follow-card').innerText(),/待主任复核/);await page.getByRole('button',{name:'清除筛选'}).click();await page.waitForURL(/#\/followups$/);assert((await page.locator('.follow-card').count())>=2);
  });
  await test('preference read failure falls back safely after identity change',async()=>{
   await page.route('**/api/campus/preferences',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'模拟偏好读取失败'})}));await role('t2');await page.locator('.teacher-layout').waitFor();assert.match(await page.locator('#page').innerText(),/周宁的教学工作台/);assert.equal(await page.evaluate(()=>document.body.dataset.density),'comfortable');assert.match(await page.locator('#toast').innerText(),/个人偏好暂未读取/);await page.unroute('**/api/campus/preferences');
  });
  await test('session expiry exposes recovery without discarding supervisor input',async()=>{
   await role('s1');await go('observations/OB-06');await page.getByLabel('教学组织',{exact:true}).fill('需要保留的课堂观察输入，用于会话异常恢复验证。');await page.route('**/api/campus/action',r=>r.fulfill({status:401,contentType:'application/json',body:JSON.stringify({message:'工作身份已失效'})}));await page.getByRole('button',{name:'保存草稿',exact:true}).click();await page.getByRole('button',{name:'重新选择身份'}).waitFor();assert.match(await page.getByLabel('教学组织',{exact:true}).inputValue(),/需要保留/);await page.getByRole('button',{name:'重新选择身份'}).click();await page.locator('.portal-entry').waitFor();await page.unroute('**/api/campus/action');await page.locator('.role-choice[data-role=supervisor]').click();await page.getByRole('button',{name:'进入教学工作空间',exact:true}).click();await page.locator('.supervisor-layout').waitFor();await go('observations/OB-06');assert.match(await page.getByLabel('教学组织',{exact:true}).inputValue(),/需要保留/);
  });
  await test('state failure after session switch cannot show old-role content',async()=>{
   await page.route('**/api/campus/state**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'模拟工作区读取失败'})}));await page.selectOption('#identity','d1');await page.locator('.portal-entry').waitFor();assert.equal(await page.locator('.observation-editor,.teacher-layout,.director-layout').count(),0);await page.unroute('**/api/campus/state**');await page.locator('.role-choice[data-role=teacher]').click();await page.getByRole('button',{name:'进入教学工作空间',exact:true}).click();
   // Earlier suites intentionally persist the teacher's preferred landing page.
   await page.waitForFunction(()=>!V.busy&&V.user?.id==='t1'&&location.hash==='#/'+W.prefs.landing);
   assert.equal(await page.locator('.observation-editor,.director-layout').count(),0);
  });
  await test('short desktop viewport retains service controls and all enhanced pages fit',async()=>{
   for(const width of [1100,1280,1440,1920]){await page.setViewportSize({width,height:720});for(const route of ['home','courses','resources','inbox','calendar','followups','catalog']){await go(route);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' '+route);const rect=await page.locator('#about').boundingBox();assert(rect&&rect.y+rect.height<=720,'service control visible');}}
  });
  assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/campus/final-interaction-results.json',JSON.stringify({passed:checks.length,checks,errors},null,2));console.log('ALL PASS '+checks.length);
 }catch(e){await page.screenshot({path:'artifacts/campus/final-failure.png',fullPage:true});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
