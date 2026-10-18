/* 可选浏览器集成测试：npm install --no-save playwright 后运行。
 * 先启动 python -m app.server；也可通过 BASE_URL 指定地址。
 * BROWSER_CHANNEL=msedge 使用已安装Edge，留空使用Playwright Chromium。 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('artifacts');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const errors = [];
  const checks = [];
  page.on('pageerror', e => errors.push(e.message));
  async function check(name, action) {
    await action();
    checks.push(name);
    console.log('PASS ' + name);
  }
  const detail = page.locator('#detail');
  async function loaded() {
    await page.locator('#identity:not([disabled])').waitFor();
    await page.locator('#term:not([disabled])').waitFor();
    await page.waitForFunction(() => !document.querySelector('#detail').textContent.includes('正在加载') && !document.querySelector('#detail').textContent.includes('正在查询'));
  }
  async function offering(id) {
    await page.locator(`[data-offering="${id}"]`).click();
    await page.waitForFunction((id) => document.querySelector('.detail-head .eyebrow')?.textContent.endsWith(id) && !document.querySelector('#tab-content')?.textContent.includes('正在加载'), id);
  }
  async function identity(id) {
    await page.selectOption('#identity', id);
    await loaded();
  }
  try {
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8000');
    await loaded();
    await check('US01.1/US01.4 default teacher has K01 K02 without duplicated joint offering', async () => {
      assert.equal(await page.locator('.offering').count(), 2);
      assert.equal(await page.locator('[data-offering="K01"]').count(), 1);
      assert.match(await detail.innerText(), /软件工程 2401/);
    });
    await check('US05.1/US05.2/US07.2 resources show four access states and source missing', async () => {
      for (const text of ['可访问', '入口失效', '暂无入口', '权限不足', '来源：未提供']) assert.match(await detail.innerText(), new RegExp(text));
      assert.equal(await page.locator('[data-resource="R06"] a').count(), 0);
      const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('[data-resource="R02"] a').click()]);
      await popup.waitForLoadState();
      assert.match(await popup.locator('body').innerText(), /2401班 Sprint 实践说明/);
      await popup.close();
    });
    await page.screenshot({path: path.join(output, 'desktop.png'), fullPage:true});
    await check('US02.2 switching offering synchronizes resource context', async () => {
      await offering('K02');
      assert.equal(await page.locator('[data-resource="R02"]').count(), 0);
      assert.equal(await page.locator('[data-resource="R03"]').count(), 1);
      assert.match(await detail.innerText(), /B306/);
    });
    await check('teacher cannot read supervision; empty teacher leaves no old detail', async () => {
      await page.getByRole('tab', {name:'督导记录'}).click();
      await page.getByText('当前模拟身份无权查阅督导记录', {exact:false}).waitFor();
      await identity('teacher-empty');
      assert.equal(await page.locator('.offering').count(), 0);
      assert.equal(await page.locator('.detail-head').count(), 0);
    });
    await check('US09.1 supervisor sees facts and can open source; K04 preserves unknown', async () => {
      await identity('supervisor');
      assert.equal(await page.locator('[data-record]').count(), 2);
      const [source] = await Promise.all([page.waitForEvent('popup'), page.locator('[data-record="D01"] a').click()]);
      await source.waitForLoadState();
      assert.match(await source.locator('body').innerText(), /模拟事实来源 D01/);
      await source.close();
      await offering('K02');
      assert.equal(await page.locator('[data-record="D01"]').count(), 0);
      assert.equal(await page.locator('[data-record="D03"]').count(), 1);
      await offering('K04');
      assert.match(await detail.innerText(), /资料未收全/);
      assert.match(await detail.innerText(), /不等于未督导/);
      await page.screenshot({path:path.join(output,'supervision-unknown.png'),fullPage:true});
    });
    await check('US02.1 missing introduction and empty resource directory', async () => {
      await offering('K03');
      assert.match(await detail.innerText(), /课程简介未提供/);
      await page.getByRole('tab', {name:'教学资源'}).click();
      await page.getByText('暂无关联资料', {exact:true}).waitFor();
    });
    await check('semester empty result and previous semester isolation', async () => {
      await page.selectOption('#term','2027-spring');
      await page.getByText('暂无开课',{exact:true}).waitFor();
      assert.equal(await page.locator('.detail-head').count(),0);
      await page.selectOption('#term','2026-spring');
      await page.locator('[data-offering="K05"]').waitFor();
      await loaded();
      assert.equal(await page.locator('.offering').count(),1);
    });
    await page.selectOption('#term','2026-fall');
    await page.locator('[data-offering="K01"]').waitFor();
    await loaded();
    await check('out-of-order detail responses cannot overwrite current selection', async () => {
      await offering('K02');
      await page.route('**/api/offerings/K01?course_id=C01', async route => {
        await new Promise(resolve=>setTimeout(resolve,350));
        try { await route.continue(); } catch { /* aborted request */ }
      });
      await page.locator('[data-offering="K01"]').click();
      await page.locator('[data-offering="K02"]').click();
      await page.waitForFunction(()=>document.querySelector('.detail-head .eyebrow')?.textContent.endsWith('K02'));
      await page.waitForTimeout(450); // Deliberately wait past injected latency to test stale-response handling.
      assert.match(await detail.innerText(), /软件工程 2402/);
      assert.equal(await page.locator('[data-resource="R02"]').count(),0);
      await page.unroute('**/api/offerings/K01?course_id=C01');
    });
    await check('keyboard tabs and mobile 390px layout', async () => {
      await page.getByRole('tab',{name:'教学资源'}).focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.getByRole('tab',{name:'督导记录'}).getAttribute('aria-selected'),'true');
      await loaded();
      await page.setViewportSize({width:390,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),true);
      await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
    });
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({executed_at:new Date().toISOString(),browser:await browser.version(),checks,passed:checks.length,page_errors:errors},null,2));
    console.log(`${checks.length} browser checks passed; no page errors.`);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
