'use strict';
const W={prefs:{density:'comfortable',landing:'home',pinned:[],read_events:[]},catalog:null,entryRole:'teacher',savingPrefs:false,catalogEpoch:0};
Object.assign(I,{inbox:'M4 4h16v16H4zM4 14h5l2 3h2l2-3h5M8 8h8M8 11h5',people:'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-2a7 6 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 4 5',star:'m12 3 2.8 5.6 6.2.9-4.5 4.4 1 6.1-5.5-2.9-5.5 2.9 1-6.1L3 9.5l6.2-.9z',settings:'M4 7h16M4 17h16M8 4v6M16 14v6',help:'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 18h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',exit:'M10 4H4v16h6M9 12h12M17 8l4 4-4 4'});

function iconButton(label,icon,fn,cls='utility-button'){const b=btn('',fn,cls);b.setAttribute('aria-label',label);b.title=label;b.append(ico(icon));return b;}
async function savePrefs(patch){
 if(W.savingPrefs||V.busy||V.writing)return false;
 const actor=V.user.id;W.savingPrefs=true;$('#identity').disabled=true;
 try{const prefs=await request('preferences',patch);if(V.user?.id!==actor)return false;W.prefs=prefs;document.body.dataset.density=prefs.density;return true;}
 catch(e){toast(e.message);return false;}
 finally{W.savingPrefs=false;$('#identity').disabled=!!V.busy||!!V.writing||!V.user;}
}

function pinButton(c){const pinned=W.prefs.pinned.includes(c.id),b=btn('',async()=>{b.disabled=true;const ids=W.prefs.pinned.includes(c.id)?W.prefs.pinned.filter(id=>id!==c.id):[...W.prefs.pinned,c.id];if(await savePrefs({pinned:ids})){render();toast(ids.includes(c.id)?'已加入常用课程':'已移出常用课程');}else b.disabled=false;},'pin-button');b.setAttribute('aria-pressed',String(pinned));b.setAttribute('aria-label',pinned?'取消常用课程':'设为常用课程');b.append(ico('star'),el('span','',pinned?'已设常用':'设为常用'));return b;}
function pendingItems(){
 if(!V.data)return[];const out=[],role=V.user.role;
 if(role==='teacher')for(const c of V.data.courses.filter(c=>!c.prepared))out.push({id:'prep-'+c.id,type:'备课',title:missing(c)?'补齐课前材料':'完成课前核对',copy:c.name+' / '+c.class_name,date:'每周'+days[c.day].slice(1)+' '+slots[c.slot],route:'course/'+c.id+(missing(c)?'/materials':''),tone:'coral'});
 if(role==='director')for(const c of V.data.courses.filter(missing))out.push({id:'material-'+c.id,type:'资料',title:'核查课前材料缺项',copy:c.name+' / '+c.class_name,date:'课前准备',route:'course/'+c.id+'/materials',tone:'coral'});
 if(role==='supervisor')for(const t of V.data.tasks.filter(t=>t.status!=='submitted')){const c=course(t.course_id);out.push({id:t.id,type:'听课',title:t.status==='draft'?'继续填写听课记录':t.date<V.data.as_of?'补齐听课记录':'准备听课与课堂观察',copy:c.name+' / '+c.class_name,date:t.date+' '+slots[c.slot],route:'observations/'+t.id,tone:'blue'});}
 for(const f of V.data.followups.filter(f=>role==='teacher'?f.status==='open':role==='director'?f.status==='replied':false)){const c=course(f.course_id);out.push({id:f.id,type:'跟进',title:role==='director'?'复核：'+f.title:f.title,copy:c.name+' / '+c.class_name,date:f.due+' 截止',route:'followups/'+f.id,tone:'gold'});}
 return out;
}
function workspaceNav(){
 const mark=document.querySelector('.semester-mark');mark.querySelector('strong').textContent=V.data.term;mark.querySelector('.semester-season').textContent=V.term.includes('autumn')?'秋':'春';
 const r=V.user.role,route=currentRoute()[0],active=route==='course'?originRoute().split(/[/?]/)[0]:route;
 const groups=[['工作空间',[['home',r==='teacher'?'我的教学':r==='director'?'教学运行总览':'听课工作台','home'],['inbox','任务与动态','inbox'],['calendar',r==='supervisor'?'听课日历':r==='director'?'全系课表':'教学周历','calendar']]],['教学业务',r==='teacher'?[['courses','任课课程','courses'],['resources','课程资料','resources'],['followups','教学反馈','feedback']]:r==='director'?[['courses','开课台账','courses'],['quality','教学核查','quality'],['followups','改进跟进','feedback']]:[['observations','听课任务','tasks'],['courses','课程档案','courses'],['followups','反馈跟进','feedback']]],['公共服务',[['catalog','公开课程库','resources'],['directory','教学团队','people']]]];
 $('#nav').replaceChildren();const rows=[];
 for(const [heading,items]of groups){$('#nav').append(el('span','nav-group',heading));for(const [id,label,icon]of items){rows.push([id,label]);const l=a('',id,'nav-item');l.append(ico(icon),el('span','',label));if(id===active)l.setAttribute('aria-current','page');if(id==='inbox'&&pendingItems().length)l.append(el('b','nav-count',pendingItems().length));$('#nav').append(l);}}
 for(const link of document.querySelectorAll('.service-link')){if(link.hash==='#/'+route)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 $('#page-title').textContent=route==='course'?(course(currentRoute()[1])?.name||'课程档案'):rows.find(x=>x[0]===route)?.[1]||({profile:'个人设置',help:'使用帮助'})[route]||'工作空间';
 document.title=$('#page-title').textContent+' · 爱教学';document.body.dataset.role=r;document.body.dataset.density=W.prefs.density;$('#avatar').textContent=V.user.name.slice(-2);$('#identity').value=V.user.id;$('#identity').disabled=!!V.busy||!!V.writing;
 $('#inbox-link').replaceChildren(ico('inbox'),el('span','','待办'),el('b','utility-count',pendingItems().length));$('#course-switch').replaceChildren(ico('courses'),el('span','','课程'));$('#course-switch').onclick=courseSwitcher;
}
function portal(){
 document.body.classList.add('portal-mode');document.title='爱教学 · 教学协作平台';const root=$('#page');root.replaceChildren();
 const mast=el('header','portal-mast'),brand=el('div','portal-brand');brand.append(el('span','brand-emblem','教'),el('strong','','爱教学'),el('span','portal-product','教学协作平台'));mast.append(brand,a('浏览公开课程资料','catalog','text-link'));root.append(mast);
 const layout=el('div','portal-layout'),intro=el('section','portal-intro'),entry=el('section','portal-entry');
 intro.append(el('p','portal-semester','2026—2027 秋季学期'),el('h1','','让教学工作，\n有序发生。'),el('p','portal-lead','从课程准备到课堂观察，让资料、任务和教学反馈在同一个空间流转。'));
 const folio=el('div','portal-folio');for(const [h,p,ic]of [['课程信息','开课档案与教学周历','courses'],['教学资源','资料发布与版本维护','resources'],['教学评价','课堂观察与改进跟进','quality']]){const card=el('div','folio-sheet');card.append(ico(ic),el('h2','',h),el('p','',p));folio.append(card);}intro.append(folio,el('p','portal-boundary','公开课程资料与独立教学场景分开管理，业务记录可追溯。'));
 entry.append(el('span','entry-mark','进入工作空间'),el('h2','','选择工作身份'),el('p','muted','各身份拥有对应的课程范围和操作权限。'));
 const chooser=el('div','role-chooser');let selected=W.entryRole;const accountBox=el('div','entry-accounts');
 const descriptions={teacher:'备课 · 资料 · 教学反馈',director:'核查 · 排程 · 改进复核',supervisor:'听课 · 记录 · 建议跟进'};
 function choose(role){selected=role;W.entryRole=role;for(const b of chooser.children)b.setAttribute('aria-pressed',String(b.dataset.role===role));accountBox.replaceChildren(field('场景账号',select('选择场景账号',V.users.filter(u=>u.role===role).map(u=>[u.id,u.name+' / '+roleNames[u.role]]),V.users.find(u=>u.role===role)?.id,()=>{})));}
 for(const role of ['teacher','director','supervisor']){const b=btn('',()=>choose(role),'role-choice');b.dataset.role=role;b.append(ico(role==='teacher'?'courses':role==='director'?'quality':'tasks'),el('strong','',roleNames[role]),el('small','',descriptions[role]));chooser.append(b);}entry.append(chooser,accountBox);choose(selected);
 const enter=btn('进入教学工作空间',async()=>{enter.disabled=true;enter.textContent='正在进入…';await changeUser(accountBox.querySelector('select').value);if(enter.isConnected){enter.disabled=false;enter.textContent='进入教学工作空间';}},'button primary entry-button');entry.append(enter);
 if(V.user)entry.append(a('继续 '+V.user.name+' 的工作','home','continue-session'));
 entry.append(el('p','entry-disclosure','本地场景账号，无需学校密码。任课、课表与业务记录为独立教学场景，非学校实时系统。'));
 layout.append(intro,entry);root.append(layout,el('div','portal-foot','第15组 · 爱教学　｜　课程信息管理 / 教学资源管理 / 教学评价管理'));
}
function afterWorkspaceRender(){
 if(currentRoute()[0]!=='home')return;
 const pinned=W.prefs.pinned.map(course).filter(Boolean);if(!pinned.length)return;
 const n=el('div','pinned-strip');n.append(ico('star'),el('strong','','常用课程'));pinned.forEach(c=>n.append(a(c.name+' / '+c.class_name,'course/'+c.id,'pinned-link')));const anchor=$('#page .term-line');if(anchor)anchor.after(n);
}
function courseSwitcher(){const body=el('div','search-body'),q=input('搜索任课或可见课程','','search'),out=el('div');body.append(q,out);const d=modal('快速进入课程',body);function draw(){out.replaceChildren();const cs=V.data.courses.filter(c=>(c.name+c.class_name).includes(q.value.trim())).sort((a,b)=>Number(W.prefs.pinned.includes(b.id))-Number(W.prefs.pinned.includes(a.id)));for(const c of cs){const b=btn('',()=>{d.close();go(a('','course/'+c.id).hash.slice(2));},'search-result');const copy=el('span');copy.append(el('strong','',c.name),el('small','',c.class_name+' / '+teacher(c)));b.append(ico(W.prefs.pinned.includes(c.id)?'star':'courses'),copy,ico('arrow'));out.append(b);}if(!cs.length)out.append(empty('没有匹配课程','尝试课程名称或教学班。'));}q.oninput=draw;draw();q.focus();}
function workspacePage(route,id){({inbox:inboxPage,catalog:catalogPage,directory:directoryPage,profile:profilePage,help:helpPage})[route](id);}
function inboxPage(){
 const root=$('#page'),items=pendingItems(),events=[...V.data.audit].reverse(),unread=events.filter(e=>!W.prefs.read_events.includes(e.id));root.append(title('任务与动态','集中处理当前身份的教学事项，查阅相关课程的业务变化。',btn('刷新',async()=>{try{await refresh();toast('业务状态已更新');}catch(e){toast(e.message);}})));
 const tabs=el('nav','tabs'),tab=routeParams().get('tab')||'tasks';for(const [id,label]of [['tasks','待处理 '+items.length],['activity','业务动态 '+unread.length+' 条未读']]){const l=a(label,'inbox'+(id==='activity'?'?tab=activity':''));if(id===tab)l.setAttribute('aria-current','page');tabs.append(l);}root.append(tabs);
 if(tab==='tasks'){taskQueue(); }else{
  const head=section('最近业务动态',btn('全部标为已读',async()=>{if(await savePrefs({read_events:events.map(e=>e.id)})){render();toast('动态已标记为已读，业务待办保持原状态');}},'button small'));root.append(head);
  const list=el('div','activity-list');for(const event of events){const c=course(event.course_id),seen=W.prefs.read_events.includes(event.id),row=el('article','activity-item'+(seen?' seen':'')),dot=el('span','activity-dot'),copy=el('div');copy.append(el('h2','',event.actor+' · '+event.action),el('p','',c.name+' / '+c.class_name),el('time','',event.at.replace('T',' ').slice(0,19)));
   row.append(dot,copy,btn(seen?'查看课程':'查看并标记已读',async()=>{if(!seen){const ids=[...new Set([...W.prefs.read_events,event.id])].filter(id=>events.some(e=>e.id===id));if(!await savePrefs({read_events:ids}))return;}go(a('','course/'+c.id+(event.action.includes('资料')?'/materials':event.action.includes('跟进')||event.action.includes('提交听课')?'/feedback':'')).hash.slice(2));},'button small'));list.append(row);}
  if(!events.length)list.append(empty('尚无业务动态','发布资料、保存记录或处理跟进后会产生真实操作记录。'));root.append(list,el('p','footnote','显示当前身份可见课程的最近100条操作。时间为实际操作时间；场景日程仍使用2026-10-15。草稿操作仅本人可见。'));
 }
}
function editResource(r){formDialog('编辑课程资料 · '+course(r.course_id).name,[{key:'title',label:'资料标题',value:r.title,min:2,max:80},{key:'scope',label:'资料适用范围',value:r.scope||'offering',options:[['offering','本开课专属'],['course','本学期同课程共用']]},{key:'source',label:'资料来源（可留空）',required:false,max:500,value:r.source||''},{key:'body',label:'资料正文',area:true,rows:12,value:r.body,min:20,max:12000}],'resource_update',{course_id:r.course_id,resource_id:r.id},'保存新版本');}
function resourceReader(r){
 const body=el('div','reading'),head=el('div','reader-meta'),c=course(r.course_id);head.append(chip(r.kind,'blue'),el('span','muted','第 '+(r.revision||1)+' 版'),el('span','muted',who(r.author)+' / '+(r.updated?r.updated.slice(0,10):r.created)));body.append(head,el('p','reader-course',c.name+' / '+c.class_name),el('p','muted',r.scope_label||'本开课专属'),el('p','resource-source',r.source?'资料来源：'+r.source:'未提供资料来源'),el('pre','document-body',r.body));
 const actions=el('div','form-actions');if(r.can_edit&&!V.data.read_only)actions.append(btn('编辑资料',()=>{d.close();editResource(r);},'button primary'));actions.append(a('进入所属课程','course/'+c.id+'/materials','button'));actions.lastChild.addEventListener('click',()=>d.close());body.append(actions);
 if(r.history?.length){const history=el('details','version-history');history.append(el('summary','','历史版本（'+r.history.length+'）'));r.history.slice().reverse().forEach((old,i)=>{const details=el('details','version-entry');details.append(el('summary','',`第 ${old.revision||1} 版 · ${old.title} · ${(old.updated||old.created||'').slice(0,10)}`),el('p','muted',old.scope==='course'?'适用范围：本学期课程共用':'适用范围：本开课专属'),el('p','resource-source',old.source?'资料来源：'+old.source:'该历史版本未提供来源记录'),el('pre','document-body',old.body));history.append(details);});body.append(history);}
 const d=modal(r.title,body);
}
function guestCatalog(){
 document.body.classList.add('portal-mode');const root=$('#page');root.replaceChildren();const mast=el('header','portal-mast'),brand=a('爱教学 · 公开课程库','portal','guest-brand');mast.append(brand,a('返回门户选择身份','portal','button primary'));root.append(mast);catalogPage(currentRoute()[1]);document.title='公开课程库 · 爱教学';
}
async function catalogPage(id){
 const root=$('#page'),epoch=++W.catalogEpoch;root.append(title('公开课程库','东北大学公开课程认定资料，作为课程建设参考；与本学期开课档案分别管理。'));const content=el('div');content.append(el('p','muted','正在读取公开目录…'));root.append(content);
 try{if(!W.catalog){const response=await fetch('/api/public-catalog');if(!response.ok)throw Error('公开目录暂不可用');W.catalog=await response.json();}if(epoch!==W.catalogEpoch||!content.isConnected)return;content.replaceChildren();
  if(id){const c=W.catalog.items.find(c=>c.id===id);if(!c){content.append(empty('没有此公开课程记录','请返回课程库重新选择。'),a('返回课程库','catalog','button'));return;}
   const backRoute=routeParams().get('from')||'catalog';content.append(a(backRoute.startsWith('course/')?'返回开课详情':'返回课程库',/^(catalog|course)([/?]|$)/.test(backRoute)?backRoute:'catalog','back-link'));const head=el('section','catalog-detail');head.append(chip(c.kind,'lilac'),el('h2','',c.name),el('p','',c.department));const facts=el('dl','facts');for(const [k,v]of [['学校',c.school],['名单负责人',c.leader],['认定批次',c.batch],['原始序号',c.source_sequence],['课程代码',c.course_code??'公开来源未提供'],['学分',c.credits??'公开来源未提供']]){const row=el('div');row.append(el('dt','',k),el('dd','',v));facts.append(row);}head.append(facts);content.append(head);
   const source=W.catalog.sources.find(s=>s.id===c.source_id);const origin=el('div','source-block');origin.append(el('h3','','原始公开来源'),el('p','',source.title+' / '+source.publisher),el('p','muted','快照 '+source.snapshot_date+' · 原表行 '+c.source_row));const link=a('查看学校原始页面',source.url,'text-link');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';origin.append(link);content.append(origin);
   const related=(V.data?.courses||[]).filter(x=>x.catalog_id===c.id);if(related.length){content.append(section('关联的场景开课'));related.forEach(x=>content.append(taskRow(x.name,x.class_name,'course/'+x.id,'blue')));}content.append(el('p','footnote','公开名单的负责人不等同于本学期任课教师，课程认定不代表督导结果。'));return;
  }
  const tools=el('div','toolbar'),q=input('搜索课程、负责人或学院',routeParams().get('q')||'','search'),out=el('div');let dept=routeParams().get('dept')||'all',page=Number(routeParams().get('page')||1);
  q.oninput=()=>{page=1;setParam('q',q.value);setParam('page','');draw();};tools.append(q,select('开课单位',[['all','全部单位'],...Array.from(new Set(W.catalog.items.map(x=>x.department))).sort().map(x=>[x,x])],dept,v=>{dept=v;page=1;setParam('dept',v);setParam('page','');draw();}));content.append(tools,out);
  function draw(){const rows=W.catalog.items.filter(x=>(dept==='all'||x.department===dept)&&(x.name+x.leader+x.department).toLowerCase().includes(q.value.trim().toLowerCase())),pages=Math.max(1,Math.ceil(rows.length/15));page=Number.isInteger(page)?Math.max(1,Math.min(page,pages)):1;out.replaceChildren(el('p','result-count',rows.length+' 条认定记录 · 每页15条'));
   if(!rows.length){out.append(empty('没有匹配的公开课程','更换关键词或单位筛选。'));return;}
   out.append(table(['课程名称','所属单位','名单负责人','类别','批次'],rows.slice((page-1)*15,page*15).map(x=>[a(x.name,'catalog/'+x.id+'?from='+encodeURIComponent(location.hash.slice(2)),'table-title'),x.department,x.leader,chip(x.kind,'blue'),x.batch])));
   const pager=el('div','pagination'),prev=btn('上一页',()=>{page--;setParam('page',String(page));draw();}),next=btn('下一页',()=>{page++;setParam('page',String(page));draw();});prev.disabled=page===1;next.disabled=page===pages;pager.append(prev,el('span','',page+' / '+pages),next);out.append(pager);
  }draw();
 }catch(e){if(content.isConnected)content.replaceChildren(empty('暂时无法读取课程库',e.message),btn('重试',()=>render(),'button primary'));}
}
function directoryPage(){
 const root=$('#page');root.append(title('教学团队','按当前可见开课建立任课联系，点击课程即可进入对应业务。'));const tools=el('div','toolbar'),q=input('搜索姓名或课程','','search'),out=el('div');tools.append(q);root.append(tools,out);q.oninput=draw;
 function draw(){out.replaceChildren();const grid=el('div','people-grid');for(const u of V.users){const cs=V.data.courses.filter(c=>c.teachers.includes(u.id));if(u.role==='teacher'&&!cs.length)continue;if(!(u.name+roleNames[u.role]+cs.map(c=>c.name).join('')).includes(q.value.trim()))continue;
  const card=el('article','person-card'),head=el('div','person-head');head.append(el('span','person-avatar '+u.role,u.name.slice(-2)),el('div'));head.lastChild.append(el('h2','',u.name),el('p','',roleNames[u.role]));card.append(head);
  if(u.role==='teacher'){card.append(el('p','person-scope',cs.length+' 个可见任课单元'));cs.forEach(c=>card.append(a(c.name+' / '+c.class_name,'course/'+c.id,'person-course')));}else card.append(el('p','person-scope',u.role==='director'?'教学核查、听课安排与改进复核':'听课观察、记录提交与反馈跟进'));grid.append(card);}
  if(!grid.children.length)out.append(empty('没有匹配的成员','尝试姓名或课程名称。'));else out.append(grid);out.append(el('p','footnote','此处为独立教学场景成员，不是东北大学真实师资名录；不展示未经提供的电话、邮箱或个人资料。'));}draw();
}
function profilePage(){
 const root=$('#page');root.append(title('个人设置','工作身份、常用课程和显示偏好集中管理。'));const layout=el('div','settings-layout'),identity=el('section','identity-panel');identity.append(el('span','profile-avatar',V.user.name.slice(-2)),el('h2','',V.user.name),chip(roleNames[V.user.role],'blue'),el('p','muted',V.data.organization),el('p','muted','本地场景账号 / '+V.user.id));identity.append(btn('退出当前身份',()=>signOut(),'button'));const settings=el('div'),form=el('form','settings-form');form.append(section('工作空间偏好'));
 const density=select('显示密度',[['comfortable','舒适：清晰留白'],['compact','紧凑：显示更多内容']],W.prefs.density,()=>{}),landing=select('进入后的默认页面',[['home','角色工作台'],['inbox','任务与动态'],['courses','课程列表'],['calendar','教学日历']],W.prefs.landing,()=>{});form.append(field('显示密度',density),field('进入后的默认页面',landing));const submit=el('button','button primary','保存偏好');submit.type='submit';form.append(submit);form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;if(await savePrefs({density:density.value,landing:landing.value})){toast('个人偏好已保存');render();}else submit.disabled=false;};settings.append(form);
 const favorites=el('div');for(const c of W.prefs.pinned.map(course).filter(Boolean)){const row=el('div','favorite-row');row.append(a(c.name+' / '+c.class_name,'course/'+c.id,'text-link'),pinButton(c));favorites.append(row);}if(!favorites.children.length)favorites.append(el('p','muted','进入课程详情，点击“设为常用”即可收藏。'));settings.append(panel('常用课程',favorites));layout.append(identity,settings);root.append(layout);
}
async function signOut(confirmed=false){
 if(V.writing)return;const prefix='aijiaoxue:observation:'+V.user.id+':';
 let hasDraft=[...V.draftMemory.keys()].some(k=>k.startsWith(prefix));try{hasDraft=hasDraft||Object.keys(sessionStorage).some(k=>k.startsWith(prefix));}catch{}
 if(hasDraft&&!confirmed){const body=el('div','reading');body.append(el('p','','当前身份还有未保存到服务器的听课输入。退出会清除此页签暂存，已保存的服务器草稿不受影响。'));const actions=el('div','form-actions'),d=modal('退出前保留工作',body);actions.append(btn('返回听课任务',()=>{d.close();go('observations');},'button primary'),btn('清除暂存并退出',()=>{d.close();signOut(true);}));body.append(actions);return;}
 try{await request('logout',{});try{for(const key of Object.keys(sessionStorage))if(key.startsWith(prefix))sessionStorage.removeItem(key);}catch{}V.draftMemory.clear();V.draftFallback.clear();V.user=null;V.data=null;W.prefs={density:'comfortable',landing:'home',pinned:[],read_events:[]};history.replaceState(null,'','#/portal');render();toast('已退出当前身份');}catch(e){toast(e.message);}
}
function helpPage(){
 const root=$('#page');root.append(title('使用帮助','围绕课程准备、听课记录和教学反馈，快速找到操作入口。'));
 const guides=[['如何切换教学学期？','在页面上方选择教学学期。开课、资料、任务和统计随之切换，空学期不显示其他学期内容。历史学期仅供查询。','courses','查看开课'],['资料怎样供同课多个教学班使用？','发布或编辑自己的资料时，将适用范围设为本学期同课程共用。共用资料只保存一份，由发布教师维护，其他任课教师可查阅；改回专属时只保留当前开课。','resources','查看资料'],['教师如何完成课前准备？','进入任课课程，登记课前材料，再确认课前准备完成。材料和核对状态分别管理。','courses','打开课程'],['如何处理教学改进事项？','教师在教学反馈中回复处理情况；主任收到回复后复核，填写结论并关闭。','followups','查看教学跟进'],['听课草稿和提交有什么区别？','输入先暂存在当前浏览器页签；保存草稿会写入服务器且仅本人可见。正式提交后教师与主任可查阅，未来日期任务不能提前提交。',V.user.role==='supervisor'?'observations':'inbox','进入相关工作'],['如何维护已发布资料？','本课教师在资料列表或阅读窗口点击编辑，保存新版本。阅读窗口可展开旧版，原内容不会被覆盖丢弃。',V.user.role==='teacher'?'resources':'courses','查看课程资料'],['公开课程与场景开课有什么区别？','公开课程库保留学校公开认定信息。场景开课、成员、课表、人数、教学材料与督导记录为本地独立场景，不能当作学校实际数据。','catalog','查阅公开课程库'],['怎样减少重复查找？','使用顶部“课程”快速切换，或按Ctrl K搜索资料。课程详情可设为常用，个人设置可调整默认入口与显示密度。','profile','打开个人设置']];
 const q=input('搜索帮助关键词','','search'),list=el('div','help-list');root.append(q,list);q.classList.add('help-search');q.oninput=draw;function draw(){list.replaceChildren();for(const [h,p,route,label]of guides.filter(g=>g.join('').includes(q.value.trim()))){const d=el('details','help-item'),summary=el('summary','',h),body=el('div');body.append(el('p','',p),a(label,route,'text-link'));d.append(summary,body);list.append(d);}if(!list.children.length)list.append(empty('没有匹配的帮助','尝试“资料”“草稿”或“反馈”等关键词。'));}draw();
 const support=el('div','help-note');support.append(ico('help'),el('p','','遇到保存失败时，先保留当前输入，再根据提示刷新状态重试。浏览器页签暂存不能替代服务器草稿。'));root.append(support);
}


// Shared task semantics are derived from the visible server state, never invented.
function defaultPrefs(){return {density:'comfortable',landing:'home',pinned:[],read_events:[]};}
function datedTasks(){
 return pendingItems().map(x=>{
  const follow=V.data.followups.find(f=>f.id===x.id),task=V.data.tasks.find(t=>t.id===x.id);
  let due=follow?.due||task?.date||null;
  if(!due&&x.id.startsWith('prep-')){const c=course(x.id.slice(5)),d=new Date(V.data.as_of+'T12:00:00');d.setDate(d.getDate()+(c.day-(d.getDay()+6)%7+7)%7);due=d.toISOString().slice(0,10);}
  const urgency=!due?'routine':due<V.data.as_of?'overdue':due===V.data.as_of?'today':'upcoming';
  return {...x,due,urgency};
 }).sort((a,b)=>({overdue:0,today:1,routine:2,upcoming:3}[a.urgency]-{overdue:0,today:1,routine:2,upcoming:3}[b.urgency])||String(a.due||'').localeCompare(String(b.due||'')));
}
function taskQueue(){
 const root=$('#page'),items=datedTasks();
 let urgency=routeParams().get('urgency')||'all',type=routeParams().get('type')||'all';
 const tabs=el('div','queue-filters'),out=el('div','inbox-list'),tools=el('div','toolbar queue-tools');
 const options=[['all','全部事项'],['overdue','已过期'],['today','今天'],['upcoming','后续安排'],['routine','待核查']];
 for(const [value,label]of options){const count=items.filter(x=>value==='all'||x.urgency===value).length,b=btn(label+' '+count,()=>{urgency=value;setParam('urgency',value);draw();},'queue-filter');b.dataset.value=value;tabs.append(b);}
 tools.append(field('事项类型',select('事项类型',[['all','全部类型'],...Array.from(new Set(items.map(x=>x.type))).map(x=>[x,x])],type,v=>{type=v;setParam('type',v);draw();})),el('span','queue-clock','按场景日期 '+V.data.as_of+' 排序'));
 root.append(tabs,tools,out);
 function draw(){for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.value===urgency));out.replaceChildren();const rows=items.filter(x=>(urgency==='all'||x.urgency===urgency)&&(type==='all'||x.type===type));
  for(const x of rows){const row=a('',x.route,'inbox-row'),copy=el('div','inbox-copy'),meta=el('div','inbox-due');copy.append(el('h2','',x.title),el('p','',x.copy));meta.append(chip(({overdue:'已过期',today:'今天处理',upcoming:'后续安排',routine:'待核查'})[x.urgency],({overdue:'coral',today:'gold',upcoming:'blue',routine:'neutral'})[x.urgency]),el('span','inbox-date',x.date));row.append(chip(x.type,x.tone),copy,meta,el('span','inbox-action','去处理'),ico('arrow'));out.append(row);}
  if(!rows.length)out.append(empty(items.length?'当前筛选没有事项':'当前没有待处理事项',items.length?'切换“全部事项”或其他类型继续查看。':'业务状态变化后，新的待办会在这里出现。'));
 }
 draw();
}
function calendarDeadlines(){
 const root=$('#page'),dates=weekDates(),first=dates[0],lastDate=new Date(first+'T12:00:00');lastDate.setDate(lastDate.getDate()+6);const last=lastDate.toISOString().slice(0,10);
 const fs=V.data.followups.filter(f=>f.status!=='closed'&&f.due>=first&&f.due<=last).sort((a,b)=>a.due.localeCompare(b.due));
 const box=el('section','deadline-panel');box.append(section('本周跟进截止事项',a('全部教学跟进','followups?status=active','text-link')));
 if(!fs.length)box.append(el('p','muted','本周没有尚未关闭的跟进截止事项。'));
 for(const f of fs){const c=course(f.course_id),row=a('','followups/'+f.id,'deadline-row');row.append(el('time','',f.due.slice(5)),el('strong','',f.title),el('span','muted',c.name+' / '+c.class_name),chip(f.status==='replied'?'待复核':f.due<V.data.as_of?'已过期':'待回复',f.status==='replied'?'blue':f.due<V.data.as_of?'coral':'gold'));box.append(row);}
 root.append(box);
}
function refineWorkspace(){
 const route=currentRoute()[0],root=$('#page');document.body.dataset.page=route;
 // Retain only navigation scrolling at short desktop heights; keep service links reachable.
 if(route==='home'){
  const term=root.querySelector('.term-line');if(term){const n=datedTasks().filter(x=>x.urgency==='today'||x.urgency==='overdue').length;if(n)term.append(a(n+' 项需优先处理','inbox','priority-shortcut'));}
 }
 if(route==='calendar')calendarDeadlines();
 if(route==='course'){
  const c=course(currentRoute()[1]);if(c){const tabs=root.querySelector('.tabs');if(tabs)for(const link of tabs.children){link.setAttribute('aria-label',link.textContent);if(link.hash.includes('/materials'))link.append(el('span','tab-count',materials(c).length));if(link.hash.includes('/feedback'))link.append(el('span','tab-count',records(c).length));}}
 }
 if(route==='followups'){
  const copy=el('div','process-strip');for(const label of ['主任提出要求','任课教师回复','主任复核关闭'])copy.append(el('span','',label));root.querySelector('.page-heading')?.after(copy);
 }
 // Keep the user on the same task while an operation is being committed.
 for(const link of document.querySelectorAll('a[href^="#/"]'))link.addEventListener('click',e=>{if(V.writing||V.busy){e.preventDefault();toast('正在保存，请完成后再切换页面。');}});
}

init();
