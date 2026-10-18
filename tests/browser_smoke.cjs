/* Desktop, real API smoke suite; run server first, then node tests/browser_smoke.cjs.
 * BASE_URL changes target; BROWSER_CHANNEL=msedge uses installed Edge. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(process.env.ARTIFACT_DIR || 'artifacts');
fs.mkdirSync(output, {recursive:true});
(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
  const page = await browser.newPage({viewport:{width:1440,height:1080}});
  page.setDefaultTimeout(10000);
  const errors = [], checks = [];
  page.on('pageerror', e => errors.push(e.message));
  const detail = page.locator('#detail');
  async function check(name, action) { await action(); checks.push(name); console.log('PASS ' + name); }
  async function settled() {
    await page.waitForFunction(() => !document.querySelector('#identity').disabled && document.querySelector('#detail').getAttribute('aria-busy') === 'false' && document.querySelector('#offering-list').getAttribute('aria-busy') === 'false' && !document.querySelector('#tab-content')?.textContent.includes('正在加载'));
  }
  async function offering(id) { await page.locator(`[data-offering="${id}"]`).click(); await settled(); assert.match(await page.locator('.detail-head .eyebrow').innerText(), new RegExp(id+'$')); }
  async function identity(id) { await page.selectOption('#identity', id); await settled(); }
  async function ids() { return page.locator('[data-offering]').evaluateAll(nodes => nodes.map(n => n.dataset.offering)); }
  async function fault(pattern, action) { await page.route(pattern, r => r.abort('failed')); try { await action(); } finally { await page.unroute(pattern); } }
  async function tab(name) { await page.getByRole('tab',{name,exact:true}).click(); await settled(); }
  try {
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8000');
    await page.locator('#identity:not([disabled])').waitFor();
    await check('explicit simulated identity; no preselected scope', async () => {
      assert.equal(await page.locator('[data-offering]').count(),0);
      assert.equal(await page.locator('#offering-count').innerText(),'—');
      await identity('teacher-a');
      assert.deepEqual(await ids(),['K01','K02']);
      assert.equal(await page.getByRole('tab',{name:'督导记录'}).count(),0);
    });
    await check('teacher resources preserve four states and open actual content', async () => {
      for (const text of ['可访问','入口失效','暂无入口','权限不足','来源：未提供']) assert.ok((await detail.innerText()).includes(text));
      assert.equal(await page.locator('[data-resource="R06"] a').count(),0);
      const [popup] = await Promise.all([page.waitForEvent('popup'),page.locator('[data-resource="R02"] a').click()]);
      await popup.waitForLoadState(); assert.match(await popup.locator('body').innerText(),/2401班/); await popup.close();
      await page.screenshot({path:path.join(output,'teacher-workspace.png'),fullPage:true});
    });
    await check('course/class/teacher search, joint filter and coherent selection', async () => {
      await page.fill('#search','软件项目'); assert.deepEqual(await ids(),['K01','K02']);
      await page.fill('#search','2402'); await settled(); assert.deepEqual(await ids(),['K02']); assert.match(await detail.innerText(),/B306/);
      assert.equal(await page.locator('[data-resource="R02"]').count(),0); assert.equal(await page.locator('[data-resource="R03"]').count(),1);
      await page.fill('#search','陈老师'); await settled(); assert.deepEqual(await ids(),['K01']);
      await page.fill('#search',''); await page.selectOption('#teaching-filter','joint'); await settled(); assert.deepEqual(await ids(),['K01']);
      await page.selectOption('#teaching-filter','single'); await settled(); assert.deepEqual(await ids(),['K02']);
      await page.fill('#search','不存在'); await settled(); assert.equal(await page.locator('.detail-head').count(),0); assert.equal(await page.locator('#offering-count').innerText(),'0');
      await page.getByRole('button',{name:'清除筛选'}).click(); await settled(); assert.deepEqual(await ids(),['K01','K02']);
    });
    await check('empty teacher and term clear previous scope', async () => {
      await identity('teacher-empty'); assert.equal((await ids()).length,0); assert.equal(await page.locator('.detail-head').count(),0);
      await identity('teacher-a'); await page.selectOption('#term','2027-spring'); await settled(); assert.equal((await ids()).length,0); assert.equal(await page.locator('.detail-head').count(),0);
      await page.selectOption('#term','2026-spring'); await settled(); assert.deepEqual(await ids(),['K05']);
      await page.selectOption('#term','2026-fall'); await settled();
    });
    await check('supervisor facts and source stay in opening context; known empty differs from incomplete', async () => {
      await identity('supervisor'); assert.deepEqual(await ids(),['K01','K02','K03','K04']);
      assert.equal(await page.locator('[data-record]').count(),2);
      const [popup] = await Promise.all([page.waitForEvent('popup'),page.locator('[data-record="D01"] a').click()]);
      await popup.waitForLoadState(); assert.match(await popup.locator('body').innerText(),/模拟事实来源 D01/); await popup.close();
      await offering('K02'); assert.equal(await page.locator('[data-record="D01"]').count(),0); assert.equal(await page.locator('[data-record="D03"]').count(),1);
      await offering('K03'); assert.match(await detail.innerText(),/当前登记范围已核对/); assert.match(await detail.innerText(),/课程简介未提供/);
      await offering('K04'); assert.match(await detail.innerText(),/资料未收全/); assert.match(await detail.innerText(),/不等于未督导/);
      await page.screenshot({path:path.join(output,'supervision-unknown.png'),fullPage:true});
      await tab('教学资源'); assert.match(await detail.innerText(),/暂无关联资料/);
    });
    await check('director restricted resource and sort preserve selected opening', async () => {
      await identity('director'); await tab('教学资源');
      assert.equal(await page.locator('[data-resource="R06"] a').count(),1);
      await page.selectOption('#sort','course'); await settled();
      const names = await page.locator('.course-name').allTextContents();
      assert.deepEqual(names,[...names].sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true})));
      assert.match(await page.locator('.detail-head .eyebrow').innerText(),/K01$/);
      await page.selectOption('#sort','class'); await settled();
      await page.screenshot({path:path.join(output,'director-workspace.png'),fullPage:true});
    });
    await check('delayed old detail cannot overwrite new selection', async () => {
      await offering('K02');
      await page.route('**/api/offerings/K01?course_id=C01', async r => { await new Promise(resolve=>setTimeout(resolve,450)); try {await r.continue();} catch {} });
      await page.locator('[data-offering="K01"]').click(); await page.locator('[data-offering="K02"]').click(); await settled();
      await page.waitForTimeout(600);
      assert.match(await detail.innerText(),/软件工程 2402/); assert.equal(await page.locator('[data-resource="R02"]').count(),0);
      await page.unroute('**/api/offerings/K01?course_id=C01');
    });
    await check('identity switch cancels late data from previous identity', async () => {
      await page.route('**/api/offerings/K01/resources', async r => { await new Promise(resolve=>setTimeout(resolve,450)); try {await r.continue();} catch {} });
      await page.locator('[data-offering="K01"]').click();
      await identity('teacher-empty'); await page.waitForTimeout(600);
      assert.equal(await page.locator('.detail-head').count(),0); assert.equal(await page.locator('[data-resource]').count(),0); assert.deepEqual(await ids(),[]);
      await page.unroute('**/api/offerings/K01/resources');
    });
    await check('failed identity clears old scope and retries chosen identity', async () => {
      await identity('director');
      await fault('**/api/demo-session', async () => { await identity('teacher-a'); assert.equal(await page.locator('.detail-head').count(),0); assert.deepEqual(await ids(),[]); assert.equal(await page.locator('#offering-count').innerText(),'—'); });
      await page.getByRole('button',{name:'重试身份确认'}).click(); await settled(); assert.deepEqual(await ids(),['K01','K02']); assert.equal(await page.getByRole('tab',{name:'督导记录'}).count(),0);
    });
    await check('failed list clears results and retry restores authorized scope', async () => {
      await fault('**/api/offerings?term_id=*', async () => { await page.selectOption('#term','2026-spring'); await settled(); assert.deepEqual(await ids(),[]); assert.equal(await page.locator('.detail-head').count(),0); assert.equal(await page.locator('#offering-count').innerText(),'—'); await page.screenshot({path:path.join(output,'list-recovery.png'),fullPage:true}); });
      await page.getByRole('button',{name:'重新查询',exact:true}).click(); await settled(); assert.deepEqual(await ids(),['K05']);
      await page.selectOption('#term','2026-fall'); await settled();
    });
    await check('detail and associated-content errors provide usable retries', async () => {
      await fault('**/api/offerings/K02?course_id=C01', async () => { await page.locator('[data-offering="K02"]').click(); await settled(); assert.equal(await page.locator('[data-resource]').count(),0); });
      await page.getByRole('button',{name:'重试开课详情'}).click(); await settled(); assert.match(await detail.innerText(),/B306/);
      await fault('**/api/offerings/K01/resources', async () => { await offering('K01'); assert.equal(await page.locator('[data-resource]').count(),0); });
      await page.getByRole('button',{name:'重试关联信息'}).click(); await settled(); assert.equal(await page.locator('[data-resource="R02"]').count(),1);
    });
    await check('keyboard tabs and desktop widths remain usable', async () => {
      await identity('supervisor');
      await page.getByRole('tab',{name:'督导记录'}).focus(); await page.keyboard.press('ArrowRight'); await settled();
      assert.equal(await page.getByRole('tab',{name:'教学资源'}).getAttribute('aria-selected'),'true');
      assert.equal(await page.getByRole('tabpanel').getAttribute('aria-labelledby'),'tab-resources');
      for (const width of [1280,1440]) { await page.setViewportSize({width,height:1000}); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),true); }
      await page.screenshot({path:path.join(output,'desktop-1440.png'),fullPage:true});
    });
    await check('switching tabs during first associated request clears current busy state', async () => {
      await tab('督导记录');
      await offering('K02');
      await page.route('**/api/offerings/K01/supervision', async r => { await new Promise(resolve=>setTimeout(resolve,450)); try {await r.continue();} catch {} });
      await page.locator('[data-offering="K01"]').click();
      await page.getByRole('tab',{name:'教学资源',exact:true}).waitFor();
      await tab('教学资源');
      await page.waitForTimeout(600);
      assert.equal(await detail.getAttribute('aria-busy'),'false');
      assert.equal(await page.locator('[data-resource="R02"]').count(),1);
      assert.equal(await page.locator('[data-record]').count(),0);
      await page.unroute('**/api/offerings/K01/supervision');
    });
    await check('bootstrap failure recovers without reload or duplicate handlers', async () => {
      await fault('**/api/bootstrap', async () => { await page.reload(); await page.getByRole('button',{name:'重新连接'}).waitFor(); assert.equal(await page.locator('.detail-head').count(),0); });
      await page.getByRole('button',{name:'重新连接'}).click(); await settled(); assert.deepEqual(await ids(),['K01','K02','K03','K04']);
    });
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({executed_at:new Date().toISOString(),browser:await browser.version(),viewport:'desktop 1280/1440',checks,passed:checks.length,page_errors:errors},null,2));
    console.log(`${checks.length} browser checks passed; no page errors.`);
  } catch(error) {
    await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});
    throw error;
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

