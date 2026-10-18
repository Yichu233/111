const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const output=process.env.ARTIFACT_DIR || 'artifacts/lms';
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function ready(){await page.waitForFunction(()=>!document.querySelector('#identity').disabled&&document.querySelector('#detail').getAttribute('aria-busy')==='false'&&!!document.querySelector('#tab-content')&&!document.querySelector('#tab-content').textContent.includes('正在加载'));}
 async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
 async function select(id){await page.selectOption('#identity',id);await ready();}
 async function screenshot(name){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,name+'.png')});}
 try{
  await page.goto(process.env.BASE_URL||'http://127.0.0.1:18767');await page.locator('#identity:not([disabled])').waitFor();await select('teacher-a');
  await check('resource grouping, filtering, no-match recovery and collapse',async()=>{
   assert.equal(await page.locator('.resource-group').count(),2);
   assert.equal(await page.locator('.resource-group').first().locator('[data-resource="R01"]').count(),1);
   assert.equal(await page.locator('.resource-group').last().locator('[data-resource="R02"]').count(),1);
   await page.getByRole('button',{name:'收起全部'}).click();assert.equal(await page.locator('.resource-group[open]').count(),0);
   await page.getByRole('button',{name:'展开全部'}).click();assert.equal(await page.locator('.resource-group[open]').count(),2);
   await page.selectOption('#resource-status','available');assert.equal(await page.locator('[data-resource]').count(),2);
   await page.fill('#resource-search','不存在');await page.getByRole('button',{name:'清除资料筛选'}).click();assert.equal(await page.locator('[data-resource]').count(),5);
  });
  await check('reader loads actual authorized content and Escape restores focus',async()=>{
   const trigger=page.locator('[data-resource="R02"] .resource-name');await trigger.click();
   await page.locator('.document-text').waitFor();assert.match(await page.locator('.document-text').innerText(),/2401/);
   assert.match(await page.locator('#reader-context').innerText(),/K01/);
   await screenshot('资源侧边阅读');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#reader').isVisible(),false);
   assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);
  });
  await check('restricted resource reader does not request protected body',async()=>{
   let count=0;const listen=r=>{if(r.url().includes('/api/resources/R06/content'))count++;};page.on('request',listen);
   await page.locator('[data-resource="R06"] .resource-name').click();
   assert.match(await page.locator('#reader-body').innerText(),/当前身份没有资料访问权限/);assert.equal(await page.locator('#reader-actions a').count(),0);assert.equal(count,0);
   await page.getByRole('button',{name:'关闭阅读',exact:true}).click();page.off('request',listen);
  });
  await check('reader retry and late response cannot overwrite next resource',async()=>{
   await page.route('**/api/resources/R02/content?*',r=>r.abort());await page.locator('[data-resource="R02"] .resource-name').click();await page.getByRole('button',{name:'重试读取'}).waitFor();
   await page.unroute('**/api/resources/R02/content?*');await page.getByRole('button',{name:'重试读取'}).click();await page.locator('.document-text').waitFor();await page.keyboard.press('Escape');
   await page.route('**/api/resources/R01/content?*',async r=>{await new Promise(resolve=>setTimeout(resolve,400));try{await r.continue();}catch{}});
   await page.locator('[data-resource="R01"] .resource-name').click();await page.getByRole('button',{name:'下一份',exact:true}).click();await page.locator('.document-text').waitFor();await page.waitForTimeout(500);
   assert.match(await page.locator('#reader-title').innerText(),/2401/);assert.match(await page.locator('.document-text').innerText(),/2401/);await page.keyboard.press('Escape');await page.unroute('**/api/resources/R01/content?*');
  });
  await check('focus mode retains selection and directory filters',async()=>{
   await page.fill('#search','软件项目');await page.selectOption('#teaching-filter','joint');await ready();
   await page.getByRole('button',{name:'专注阅读',exact:true}).click();assert.equal(await page.locator('#course-index').isVisible(),false);assert.match(await page.locator('.eyebrow').innerText(),/K01$/);
   await screenshot('专注阅读模式');await page.getByRole('button',{name:'显示开课目录'}).click();assert.equal(await page.inputValue('#search'),'软件项目');assert.equal(await page.inputValue('#teaching-filter'),'joint');
   await page.fill('#search','');await page.selectOption('#teaching-filter','all');await ready();
  });
  await check('opening navigation and role switch clear stale reader context',async()=>{
   await page.getByRole('button',{name:'下一开课',exact:true}).click();await ready();assert.match(await page.locator('.eyebrow').innerText(),/K02$/);assert.equal(await page.locator('[data-resource="R02"]').count(),0);
   await page.getByRole('button',{name:'上一开课',exact:true}).click();await ready();
   await page.locator('[data-resource="R02"] .resource-name').click();await page.locator('.document-text').waitFor();
   await page.evaluate(()=>{const select=document.querySelector('#identity');select.value='supervisor';select.dispatchEvent(new Event('change'));});await ready();
   assert.equal(await page.locator('#reader').isVisible(),false);assert.equal(await page.locator('#reader-body').innerText(),'');assert.equal(await page.locator('[data-record]').count(),2);
   await screenshot('督导工作区');
  });
  await check('course overview toggles and keyboard tabs retain resource filters',async()=>{
   await page.locator('.course-overview summary').click();assert.equal(await page.locator('.course-overview').getAttribute('open'),null);
   await page.locator('[data-role-action="arrangement"]').count();
   await page.getByRole('tab',{name:'教学资源',exact:true}).click();await ready();await page.fill('#resource-search','Sprint');assert.equal(await page.locator('[data-resource]').count(),1);
   await page.getByRole('tab',{name:'督导记录'}).focus();await page.keyboard.press('Enter');await ready();await page.keyboard.press('ArrowRight');await ready();assert.equal(await page.inputValue('#resource-search'),'Sprint');
   await page.fill('#resource-search','');await page.locator('.course-overview summary').click();
  });
  await check('desktop 1100/1280/1440/1920 has no horizontal overflow',async()=>{
   await select('director');await page.getByRole('tab',{name:'教学资源',exact:true}).click();await ready();
   for(const width of [1100,1280,1440,1920]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await screenshot('桌面-'+width);}
   await page.setViewportSize({width:1440,height:1000});await select('teacher-a');await screenshot('教师工作区');
  });
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'lms-results.json'),JSON.stringify({time:new Date().toISOString(),browser:await browser.version(),checks,passed:checks.length,pageErrors:errors},null,2));
 }catch(e){await page.screenshot({path:path.join(output,'lms-failure.png')});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
