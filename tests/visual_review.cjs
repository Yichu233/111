// Read-only capture of the actual local workspace; does not modify business state.
const {chromium}=require('playwright'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1440,height:900}}),base=process.env.AIJIAOXUE_BASE_URL||'http://127.0.0.1:18775';
 const dir='../audit';fs.mkdirSync(dir,{recursive:true});const failures=[];page.on('pageerror',e=>failures.push(e.message));
 async function ready(){await page.waitForFunction(()=>document.querySelector('#page')?.getAttribute('aria-busy')==='false');}
 async function go(route){await page.goto(base+'/#/'+route);await ready();}
 async function shot(name){await page.screenshot({path:dir+'/'+name+'.png',fullPage:false});}
 async function role(id){await page.selectOption('#identity',id);await page.waitForFunction(id=>!document.querySelector('#identity').disabled&&document.querySelector('#identity').value===id,id);}
 try{
 await go('portal');await shot('after-portal');await page.getByRole('button',{name:'进入教学工作空间',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#identity').disabled);await go('home');await shot('after-teacher');
 for(const [route,name]of [['courses','courses'],['resources','resources'],['inbox','inbox'],['course/CL-01','course'],['catalog','catalog'],['directory','directory'],['profile','profile'],['help','help']]){await go(route);if(route==='catalog')await page.locator('tbody tr').first().waitFor();await shot('after-'+name);}
 await role('d1');await go('home');await shot('after-director');await go('calendar');await shot('after-calendar');await go('quality');await shot('after-quality');await go('followups');await shot('after-followups');
 await role('s1');await go('home');await shot('after-supervisor');await go('observations/OB-03');await shot('after-observation');await page.locator('.record-actions').scrollIntoViewIfNeeded();await shot('after-observation-actions');
 fs.writeFileSync(dir+'/visual-capture.json',JSON.stringify({viewport:{width:1440,height:900},businessMutations:false,pageErrors:failures},null,2));if(failures.length)throw Error(failures.join('\n'));console.log('Captured 17 current-version screens; no page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
