// Uses the runner's disposable database; never writes the demonstration database.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),base=process.env.AIJIAOXUE_BASE_URL,checks=[],errors=[];
 assert(base,'Use run_browser_suite.py.');page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 async function ready(){await page.waitForFunction(()=>!V.busy&&document.querySelector('#page')?.getAttribute('aria-busy')==='false');}
 async function go(route){await page.goto(base+'/#/'+route);await ready();}
 async function role(id){await page.selectOption('#identity',id);await page.waitForFunction(id=>!V.busy&&V.user?.id===id,id);}
 async function term(id){await page.getByLabel('选择教学学期').selectOption(id);await page.waitForFunction(id=>!V.busy&&V.term===id,id);}
 async function test(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
 const title='学期与共用范围浏览器核验';
 const row=()=>page.locator('.resource-row').filter({has:page.getByRole('button',{name:title,exact:true})});
 try{
 await go('portal');await page.getByLabel('选择场景账号').selectOption('t1');await page.getByRole('button',{name:'进入教学工作空间',exact:true}).click();await ready();
 await test('term selector clears empty results and survives reload for each role',async()=>{
  for(const id of ['t1','d1','s1']){await role(id);await term('2027-spring');assert.match(await page.locator('#page').innerText(),/本学期暂无可见开课/);assert.equal(await page.locator('.resource-row,.course-hero,.visit-card').count(),0);await page.reload();await ready();assert.equal(await page.getByLabel('选择教学学期').inputValue(),'2027-spring');await term('2026-autumn');await go('courses');assert.ok((await page.locator('tbody tr').count())>0);}
 });
 await test('failed term request restores the original context',async()=>{
  await page.route('**/api/campus/state?term_id=2026-spring',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'隔离测试读取失败'})}));
  await page.getByLabel('选择教学学期').selectOption('2026-spring');await page.waitForFunction(()=>!V.busy&&V.term==='2026-autumn');assert.match(await page.locator('#toast').innerText(),/学期切换未完成/);assert.ok((await page.locator('tbody tr').count())>0);await page.unroute('**/api/campus/state?term_id=2026-spring');
 });
 await test('publisher can create shared material through the actual form',async()=>{
  await role('t1');await go('course/CL-01/materials');await page.getByRole('button',{name:'新建课程资料',exact:true}).click();await page.getByLabel('资料标题',{exact:true}).fill(title);await page.getByLabel('资料适用范围',{exact:true}).selectOption('course');await page.getByLabel('资料正文',{exact:true}).fill('隔离浏览器测试资料，用于检查同学期相同课程的多个开课之间的共用范围与维护权限。');await page.getByRole('button',{name:'发布到场景课程',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});assert.match(await row().innerText(),/本学期课程共用/);
 });
 await test('second class can read shared material and keeps its own return context',async()=>{
  await role('t2');await go('course/CL-02/materials');assert.equal(await row().count(),1);assert.equal(await row().getByRole('button',{name:'编辑',exact:true}).count(),0);await row().getByRole('button',{name:'阅读',exact:true}).click();assert.match(await page.locator('.reader-course').innerText(),/2402/);await page.getByRole('link',{name:'进入所属课程',exact:true}).click();assert.match(page.url(),/course\/CL-02\/materials/);
  await go('resources?course=CL-02');assert.match(await row().locator('.resource-context').innerText(),/2402/);await row().getByRole('button',{name:'阅读',exact:true}).click();assert.match(await page.locator('.reader-course').innerText(),/2402/);await page.getByRole('button',{name:'关闭',exact:true}).click();
 });
 await test('director and supervisor read shared materials without edit privileges',async()=>{
  for(const id of ['d1','s1']){await role(id);await go('course/CL-02/materials');assert.equal(await row().count(),1);assert.equal(await row().getByRole('button',{name:'编辑',exact:true}).count(),0);}
 });
 await test('scope narrowing preserves history and removes material from another class',async()=>{
  await role('t1');await go('course/CL-01/materials');await row().getByRole('button',{name:'编辑',exact:true}).click();await page.getByLabel('资料适用范围',{exact:true}).selectOption('offering');await page.getByRole('button',{name:'保存新版本',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});await row().getByRole('button',{name:'阅读',exact:true}).click();await page.locator('summary').filter({hasText:'历史版本'}).click();await page.locator('.version-entry summary').click();assert.match(await page.locator('.version-entry').innerText(),/本学期课程共用/);await page.getByRole('button',{name:'关闭',exact:true}).click();await role('t2');await go('course/CL-02/materials');assert.equal(await row().count(),0);
 });
 await test('term control and materials fit desktop layouts',async()=>{
  for(const width of [1100,1440,1920]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'artifacts/campus/term-materials.png',fullPage:true});
 });
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/campus/terms-resources-results.json',JSON.stringify({passed:checks.length,checks,errors},null,2));console.log('ALL PASS '+checks.length);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
