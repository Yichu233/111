const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),base=process.env.AIJIAOXUE_BASE_URL,checks=[],errors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 async function ready(){await page.waitForFunction(()=>document.querySelector('#page').getAttribute('aria-busy')==='false');}
 async function go(route){await page.goto(base+'/#/'+route);await ready();}
 async function role(id){await page.selectOption('#identity',id);await page.waitForFunction(x=>!document.querySelector('#identity').disabled&&document.querySelector('#identity').value===x,id);}
 async function test(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
 try{
 await go('portal');await page.getByLabel('选择场景账号').selectOption('t1');await page.getByRole('button',{name:'进入教学工作空间',exact:true}).click();await page.waitForFunction(()=>!V.busy&&V.user?.id==='t1');
 await test('course introduction is distinct from weekly topic and missing official code stays explicit',async()=>{
  await go('course/CL-01');const info=page.locator('.panel').filter({has:page.getByRole('heading',{name:'课程信息',exact:true})});
  assert.match(await info.innerText(),/范围与需求/);assert.match(await info.innerText(),/公开来源未提供/);assert.match(await info.innerText(),/非学校官方简介/);
  assert.match(await page.locator('#page').innerText(),/本周主题/);await page.screenshot({path:'artifacts/campus/evidence-course.png',fullPage:true});
 });
 await test('material reader labels existing offering scope and actual scenario provenance',async()=>{
  await go('course/CL-01/materials');await page.locator('.resource-row').first().getByRole('button',{name:'阅读',exact:true}).click();
  assert.match(await page.locator('dialog').innerText(),/本开课专属/);assert.match(await page.locator('dialog .reading > .resource-source').innerText(),/独立教学场景编写/);
  await page.getByRole('button',{name:'关闭',exact:true}).click();
 });
 const title='来源边界验证材料';
 await test('publishing without provenance retains an explicit unknown source',async()=>{
  await page.getByRole('button',{name:'新建课程资料',exact:true}).click();await page.getByLabel('资料标题',{exact:true}).fill(title);
  await page.getByLabel('资料正文',{exact:true}).fill('本资料用于隔离测试，验证来源缺失、版本保留和角色权限，不表示学校实际教学文件。');
  await page.getByRole('button',{name:'发布到场景课程',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
  const row=page.locator('.resource-row').filter({has:page.getByRole('button',{name:title,exact:true})});assert.match(await row.innerText(),/未提供资料来源/);
 });
 await test('editing only the source creates a revision with preserved old provenance',async()=>{
  let row=page.locator('.resource-row').filter({has:page.getByRole('button',{name:title,exact:true})});await row.getByRole('button',{name:'编辑',exact:true}).click();
  await page.getByLabel('资料来源（可留空）',{exact:true}).fill('项目小组自编材料，当前隔离测试中登记。');await page.getByRole('button',{name:'保存新版本',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
  row=page.locator('.resource-row').filter({has:page.getByRole('button',{name:title,exact:true})});await row.getByRole('button',{name:'阅读',exact:true}).click();
  assert.match(await page.locator('dialog .resource-source').first().innerText(),/小组自编/);await page.locator('summary').filter({hasText:'历史版本'}).click();
  await page.locator('.version-entry summary').click();assert.match(await page.locator('.version-entry').innerText(),/该历史版本未提供来源记录/);await page.getByRole('button',{name:'关闭',exact:true}).click();
 });
 await test('director and supervisor can read the same metadata without gaining edit permissions',async()=>{
  for(const id of ['d1','s1']){await role(id);await go('course/CL-01/materials');assert.equal(await page.getByRole('button',{name:'编辑',exact:true}).count(),0);assert.match(await page.locator('#page').innerText(),/本开课专属/);}
 });
 await test('long provenance is plain text and does not overflow the desktop reader',async()=>{
  await role('t1');await go('course/CL-01/materials');const row=page.locator('.resource-row').filter({has:page.getByRole('button',{name:title,exact:true})});await row.getByRole('button',{name:'编辑',exact:true}).click();
  await page.getByLabel('资料来源（可留空）',{exact:true}).fill('隔离检查：'+'来源文字'.repeat(100));await page.getByRole('button',{name:'保存新版本',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});await row.getByRole('button',{name:'阅读',exact:true}).click();
  assert.equal(await page.locator('dialog .resource-source a').count(),0);assert.ok(await page.locator('dialog').evaluate(n=>n.scrollWidth<=n.clientWidth+1));await page.screenshot({path:'artifacts/campus/evidence-source.png',fullPage:true});
 });
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/campus/course-evidence-results.json',JSON.stringify({passed:checks.length,checks,errors},null,2));console.log('ALL PASS '+checks.length);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
