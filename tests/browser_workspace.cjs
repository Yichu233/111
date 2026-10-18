const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const b=await chromium.launch({headless:true,channel:'msedge'}),p=await b.newPage({viewport:{width:1440,height:1000}}),base=process.env.AIJIAOXUE_BASE_URL||'http://127.0.0.1:18774',checks=[],errors=[];
 p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));
 async function ready(){await p.waitForFunction(()=>document.querySelector('#page').getAttribute('aria-busy')==='false');}
 async function go(r){await p.goto(base+'/#/'+r);await ready();}
 async function role(id){await p.selectOption('#identity',id);await p.waitForFunction(id=>!document.querySelector('#identity').disabled&&document.querySelector('#identity').value===id,id);}
 async function test(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
 try{
 await go('portal');
 await test('entry portal uses explicit scene identity and opens each matching workspace',async()=>{
  assert.equal(await p.locator('.role-choice').count(),3);assert.match(await p.locator('.entry-disclosure').innerText(),/无需学校密码/);
  await p.locator('.role-choice[data-role=teacher]').click();await p.getByLabel('选择场景账号').selectOption('t1');await p.getByRole('button',{name:'进入教学工作空间',exact:true}).click();await p.locator('.teacher-layout').waitFor();
  await role('d1');await p.locator('.director-layout').waitFor();await role('s1');await p.locator('.supervisor-layout').waitFor();
 });
 await test('favorites and display preferences persist across reload and remain user scoped',async()=>{
  await role('t1');await go('course/CL-01');await p.getByRole('button',{name:'设为常用课程',exact:true}).click();await p.getByRole('button',{name:'取消常用课程',exact:true}).waitFor();
  await go('home');assert.equal(await p.locator('.pinned-link').count(),1);await go('profile');await p.getByLabel('显示密度',{exact:true}).selectOption('compact');await p.getByLabel('进入后的默认页面',{exact:true}).selectOption('inbox');await p.getByRole('button',{name:'保存偏好'}).click();await p.waitForFunction(()=>document.body.dataset.density==='compact');await p.reload();await ready();assert.equal(await p.getByLabel('显示密度',{exact:true}).inputValue(),'compact');
  await role('t2');await go('profile');assert.equal(await p.locator('.favorite-row').count(),0);assert.equal(await p.getByLabel('显示密度',{exact:true}).inputValue(),'comfortable');
  await role('t1');await p.waitForURL(/#\/inbox$/);assert.equal(await p.evaluate(()=>document.body.dataset.density),'compact');
 });
 await test('course switcher keeps scope and source context',async()=>{
  await go('inbox');await p.getByRole('button',{name:'快速切换课程'}).click();await p.getByRole('searchbox').fill('编译方法');assert.equal(await p.locator('.search-result').count(),0);await p.getByRole('searchbox').fill('软件项目管理');await p.locator('.search-result').first().click();await p.locator('.course-hero').waitFor();await p.getByRole('link',{name:'返回任务中心',exact:true}).click();await p.waitForURL(/#\/inbox$/);
 });
 await test('material editing creates a visible revision and preserves the old version',async()=>{
  await go('course/CL-01/materials');const first=p.locator('.resource-row').first();const oldTitle=await first.locator('.resource-title').innerText();await first.getByRole('button',{name:'阅读',exact:true}).click();const oldBody=await p.locator('.document-body').innerText();await p.getByRole('button',{name:'编辑资料',exact:true}).click();await p.getByLabel('资料标题',{exact:true}).fill('软件项目管理课堂研讨说明');await p.getByLabel('资料正文',{exact:true}).fill(oldBody+'\n新增讨论环节：每组记录职责边界、验收标准和需求变化的影响，课堂结束前进行交叉核对。');await p.getByRole('button',{name:'保存新版本',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('dialog[open]'));
  await p.getByRole('button',{name:'软件项目管理课堂研讨说明',exact:true}).click();assert.match(await p.locator('.reader-meta').innerText(),/第 2 版/);await p.locator('.version-history>summary').click();await p.locator('.version-entry>summary').click();assert.match(await p.locator('.version-entry').innerText(),new RegExp(oldTitle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.equal(await p.locator('.version-entry .document-body').innerText(),oldBody);await p.getByRole('button',{name:'关闭',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('dialog'));
  await role('d1');await go('course/CL-01/materials');await p.getByRole('button',{name:'软件项目管理课堂研讨说明',exact:true}).click();assert.equal(await p.getByRole('button',{name:'编辑资料',exact:true}).count(),0);await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('dialog'));
 });
 await test('activity read state is persistent and does not complete business tasks',async()=>{
  await role('t1');await go('inbox');const taskCount=await p.locator('.inbox-row').count();await go('inbox?tab=activity');await p.locator('.activity-item').first().waitFor();assert.match(await p.locator('.activity-list').innerText(),/更新课程资料/);await p.getByRole('button',{name:'全部标为已读'}).click();await p.waitForFunction(()=>[...document.querySelectorAll('.activity-item')].every(x=>x.classList.contains('seen')));await p.reload();await ready();assert.equal(await p.locator('.activity-item:not(.seen)').count(),0);await go('inbox');assert.equal(await p.locator('.inbox-row').count(),taskCount);
 });
 await test('integrated public catalog filters paginates and traces sources without leaving shell',async()=>{
  await go('catalog');await p.locator('tbody tr').first().waitFor();assert.match(await p.locator('.result-count').innerText(),/345/);assert.equal(await p.locator('tbody tr').count(),15);await p.getByRole('button',{name:'下一页',exact:true}).click();assert.match(await p.locator('.pagination').innerText(),/2 \/ 23/);await p.getByRole('searchbox').fill('软件项目管理');assert((await p.locator('tbody tr').count())>=1);await p.locator('tbody .table-title').first().click();await p.locator('.source-block').waitFor();assert.match(await p.locator('#page').innerText(),/公开来源未提供/);assert.match(await p.getByRole('link',{name:'查看学校原始页面'}).getAttribute('href'),/^https:\/\/aao.neu.edu.cn/);assert.equal(await p.locator('.rail').isVisible(),true);
 });
 await test('team directory reflects visible assignments and help points to working modules',async()=>{
  await role('t1');await go('directory');assert.equal(await p.locator('.person-card').count(),4);await p.getByRole('searchbox').fill('周宁');assert.equal(await p.locator('.person-card').count(),1);await p.locator('.person-course').first().click();await p.locator('.course-hero').waitFor();await p.getByRole('link',{name:'返回教学团队',exact:true}).click();await p.waitForURL(/#\/directory$/);
  await go('help');await p.getByRole('searchbox').fill('草稿');await p.locator('.help-item').first().locator('summary').click();assert.match(await p.locator('.help-item[open]').innerText(),/服务器/);
 });
 await test('logout protects unsaved observation and actually invalidates the session',async()=>{
  await role('s1');await go('observations/OB-04');await p.getByLabel('课堂互动',{exact:true}).fill('退出测试：这段课堂观察尚未保存到服务器，退出前必须提示处理。');await go('profile');await p.getByRole('button',{name:'退出当前身份',exact:true}).click();await p.getByRole('dialog',{name:'退出前保留工作'}).waitFor();await p.getByRole('button',{name:'返回听课任务'}).click();await p.locator('.observation-form').waitFor();await go('profile');await p.getByRole('button',{name:'退出当前身份',exact:true}).click();await p.getByRole('button',{name:'清除暂存并退出',exact:true}).click();await p.locator('.portal-entry').waitFor();const status=await p.evaluate(async()=>(await fetch('/api/campus/state')).status);assert.equal(status,401);await p.reload();await ready();assert.equal(await p.locator('.portal-entry').count(),1);
 });
 await test('portal and every new module fit desktop sizes with keyboard-visible controls',async()=>{
  for(const width of [1100,1440,1920]){await p.setViewportSize({width,height:900});await go('portal');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'portal '+width);if(await p.locator('.portal-entry').count()){await p.getByRole('button',{name:'进入教学工作空间',exact:true}).click();await p.waitForFunction(()=>!document.body.classList.contains('portal-mode'));}
   for(const r of ['inbox','inbox?tab=activity','catalog','directory','profile','help','course/CL-01/materials']){await go(r);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),r+' '+width);assert.equal(await p.locator('#page button,#page a').evaluateAll(ns=>ns.filter(n=>!n.textContent.trim()&&!n.getAttribute('aria-label')).length),0);}
  }
 });
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/campus/workspace-results.json',JSON.stringify({passed:checks.length,checks,errors},null,2));console.log('ALL PASS '+checks.length);
 }catch(e){await p.screenshot({path:'artifacts/campus/workspace-failure.png',fullPage:true});throw e;}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
