'use strict';
const $=s=>document.querySelector(s),V={data:null,user:null,users:[],version:0,query:'',filter:'all',week:0,busy:false,epoch:0,draftMemory:new Map(),draftFallback:new Set()};
const roleNames={teacher:'教师',director:'教研室主任',supervisor:'教学督导'};
const I={home:'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10',courses:'M4 4h7v16H4zM13 4h7v16h-7M7 8h1M16 8h1',calendar:'M4 5h16v16H4zM8 3v5M16 3v5M4 10h16M8 14h2M14 14h2',resources:'M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h6',tasks:'M9 4h10v17H5V4h4M9 3h6v4H9zM8 12l2 2 5-5M8 18h7',feedback:'M4 4h16v13H9l-5 4zM8 8h8M8 12h5',quality:'M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7',arrow:'M5 12h14M14 7l5 5-5 5',search:'M10 17a7 7 0 1 1 0-14 7 7 0 0 1 0 14M15 15l6 6',check:'m5 12 4 4L19 6',clock:'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'};
function el(t,c,text){const n=document.createElement(t);if(c)n.className=c;if(text!==undefined)n.textContent=String(text);return n;}
function ico(k){const n=document.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('viewBox','0 0 24 24');n.setAttribute('aria-hidden','true');const p=document.createElementNS(n.namespaceURI,'path');p.setAttribute('d',I[k]||I.courses);n.append(p);return n;}
function btn(label,fn,cls='button'){const n=el('button',cls,label);n.type='button';n.onclick=fn;return n;}
function a(label,path,cls=''){
 const n=el('a',cls,label);if(cls==='back-link')n.setAttribute('aria-label',label);
 if(path.startsWith('course/')){
  const parts=path.split('?'),p=new URLSearchParams(parts[1]||'');
  if(!p.has('from'))p.set('from',currentRoute()[0]==='course'?originRoute():(location.hash.slice(2)||'home'));
  path=parts[0]+'?'+p;
 }
 n.href=path.startsWith('/')?path:'#/'+path;return n;
}
function field(label,control){const n=el('label','field');n.append(el('span','field-label',label),control);return n;}
function input(label,value='',type='text'){const n=el('input');n.type=type;n.value=value;n.setAttribute('aria-label',label);if(type==='search')n.placeholder=label;return n;}
function select(label,choices,value,change){const n=el('select');n.setAttribute('aria-label',label);choices.forEach(([v,t])=>{const o=el('option','',t);o.value=v;n.append(o);});n.value=value;n.onchange=()=>change(n.value);return n;}
function toast(msg){$('#toast').textContent=msg;clearTimeout(V.timer);V.timer=setTimeout(()=>$('#toast').textContent='',4200);}
function title(h,p,action){const n=el('div','page-heading'),copy=el('div');copy.append(el('h1','',h),el('p','',p));n.append(copy);if(action)n.append(action);return n;}
function section(h,action){const n=el('div','section-heading');n.append(el('h2','',h));if(action)n.append(action);return n;}
function empty(h,p){const n=el('div','empty');n.append(ico('courses'),el('h2','',h),el('p','',p));return n;}
function chip(label,type='neutral'){return el('span','chip '+type,label);}
function panel(h,body,cls=''){const n=el('section','panel '+cls);n.append(section(h),body);return n;}
function table(headers,rows){const wrap=el('div','table-wrap'),t=el('table'),thead=el('thead'),tr=el('tr');headers.forEach(h=>{const th=el('th','',h);th.scope='col';tr.append(th);});thead.append(tr);t.append(thead);const body=el('tbody');rows.forEach(row=>{const tr=el('tr');row.forEach(value=>{const td=el('td');td.append(value instanceof Node?value:document.createTextNode(String(value??'未提供')));tr.append(td);});body.append(tr);});t.append(body);wrap.append(t);return wrap;}
function who(id){return V.users.find(u=>u.id===id)?.name||id;}
function course(id){return V.data.courses.find(c=>c.id===id);}
function teacher(c){return c.teachers.map(who).join('、');}
function own(c){return V.user.role==='teacher'&&c.teachers.includes(V.user.id);}
const days=['周一','周二','周三','周四','周五'],slots=['08:30—10:05','10:20—11:55','14:00—15:35'];
function when(c){return days[c.day]+' '+slots[c.slot];}
function materials(c){return V.data.resources.filter(r=>r.course_id===c.id);}
function missing(c){return !materials(c).some(r=>r.kind==='课前材料');}
function records(c){return V.data.tasks.filter(t=>t.course_id===c.id&&t.status==='submitted');}
function currentRoute(){return (location.hash.slice(2).split('?')[0]||'home').split('/');}
function routeParams(){return new URLSearchParams(location.hash.split('?')[1]||'');}
function setParam(key,value){const p=routeParams();if(value&&value!=='all')p.set(key,value);else p.delete(key);history.replaceState(null,'','#/'+currentRoute().join('/')+(p.size?'?'+p:''));}
function originRoute(){const from=routeParams().get('from')||'courses';return /^(home|courses|calendar|resources|observations|followups|quality)([/?]|$)/.test(from)?from:'courses';}
function routeLabel(r){return ({home:'工作台',courses:'开课列表',calendar:'周历',resources:'资料列表',observations:'听课任务',followups:'教学跟进',quality:'教学核查'})[r.split(/[/?]/)[0]]||'开课列表';}
function notFound(h='没有找到这个页面',p='链接可能已经失效，请从左侧导航重新进入。'){const root=$('#page');root.append(empty(h,p),a('返回工作台','home','button primary recovery'));}
function go(r){if(location.hash==='#/'+r)render();else location.hash='/'+r;}
async function request(path,payload){const r=await fetch('/api/campus/'+path,payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{});const d=await r.json();if(!r.ok){const e=new Error(d.message||'请求未完成');e.status=r.status;throw e;}return d;}
function apply(d){V.data=d.data;V.data.tasks.sort((a,b)=>a.date.localeCompare(b.date)||(course(a.course_id)?.slot??0)-(course(b.course_id)?.slot??0));V.user=d.user;V.users=d.users;V.version=d.version;}
async function refresh(){apply(await request('state'));render();}
async function changeUser(id){
 if(V.busy||V.writing){$('#identity').value=V.user.id;return;}V.busy=true;$('#identity').disabled=true;const epoch=++V.epoch;
 try{await request('session',{user_id:id});const d=await request('state');if(epoch!==V.epoch)return;apply(d);V.query='';V.filter='all';V.week=0;history.replaceState(null,'','#/home');render();window.scrollTo(0,0);}
 catch(e){$('#identity').value=V.user.id;$('#network').textContent=e.message;}
 finally{V.busy=false;$('#identity').disabled=false;}
}
async function mutate(action,params){const d=await request('action',{action,version:V.version,...params});apply(d);render();return d;}
function nav(){const r=V.user.role;const rows=r==='teacher'?[['home','我的教学','home'],['courses','任课课程','courses'],['calendar','教学周历','calendar'],['resources','课程资料','resources'],['followups','教学反馈','feedback']]:r==='director'?[['home','教学运行总览','home'],['courses','开课台账','courses'],['quality','教学核查','quality'],['followups','改进跟进','feedback'],['calendar','全系课表','calendar']]:[['home','听课工作台','home'],['observations','听课任务','tasks'],['courses','课程档案','courses'],['calendar','听课日历','calendar'],['followups','反馈跟进','feedback']];const route=currentRoute()[0],active=route==='course'?originRoute().split(/[/?]/)[0]:route;$('#nav').replaceChildren();rows.forEach(([id,label,icon])=>{const l=a('',id,'nav-item');l.append(ico(icon),el('span','',label));if(id===active)l.setAttribute('aria-current','page');if(id==='followups'){const n=V.data.followups.filter(f=>f.status===(r==='teacher'?'open':'replied')).length;if(n&&r!=='supervisor')l.append(el('b','nav-count',n));}$('#nav').append(l);});$('#page-title').textContent=route==='course'?(course(currentRoute()[1])?.name||'课程档案'):(rows.find(x=>x[0]===active)?.[1]||'工作空间');document.title=$('#page-title').textContent+' · 爱教学';document.body.dataset.role=r;$('#avatar').textContent=V.user.name.slice(-2);$('#identity').value=V.user.id;}
function termline(){const n=el('div','term-line');n.append(chip('第6教学周','blue'),el('span','',V.data.term),el('span','scene-date','场景日期 2026.10.15 · 星期四'));return n;}
function taskRow(h,copy,href,type='coral'){const n=a('',href,'task-row');n.append(el('span','task-dot '+type),el('div','task-copy'),ico('arrow'));n.children[1].append(el('strong','',h),el('small','',copy));return n;}
function teacherHome(){
 const root=$('#page');V.week=0;root.append(termline());
 const cs=V.data.courses,today=(new Date(V.data.as_of+'T12:00:00').getDay()+6)%7;
 const scheduled=cs.filter(c=>c.day===today).sort((a,b)=>a.slot-b.slot);
 const header=el('section','teaching-hero'),copy=el('div','hero-copy');
 copy.append(el('p','hello',V.user.name+'的教学工作台'),el('h1','','把课堂准备，安排妥当。'),el('p','',`${cs.length} 个任课单元 · ${cs.filter(c=>!c.prepared).length} 个课前待核对 · ${V.data.followups.filter(f=>f.status==='open').length} 项反馈待回复`),a('查看教学周历','calendar','button light'));
 const todayBox=el('div','today-agenda');todayBox.append(el('span','agenda-label','今日课程'),el('span','agenda-date',V.data.as_of.slice(5).replace('-',' / ')));
 if(scheduled.length)scheduled.forEach(c=>{const row=a('','course/'+c.id,'today-lesson');row.append(el('b','',slots[c.slot]),el('strong','',c.name),el('small','',c.class_name+' · '+c.room),ico('arrow'));todayBox.append(row);});else todayBox.append(el('h2','','今天没有排课'),el('p','','可以提前查阅本周资料，或处理教学反馈。'));
 header.append(copy,todayBox);root.append(header);
 const layout=el('div','teacher-layout'),left=el('div'),right=el('aside');left.append(section('任课课程',a('开课列表','courses','text-link')));
 const books=el('div','course-books');cs.forEach(c=>books.append(book(c)));left.append(books);
 const todo=el('div');cs.filter(c=>!c.prepared).forEach(c=>todo.append(taskRow(missing(c)?'补齐课前材料':'完成课前核对',c.name+' / '+c.class_name,'course/'+c.id+(missing(c)?'/materials':''))));
 V.data.followups.filter(f=>f.status==='open').forEach(f=>todo.append(taskRow(f.title,course(f.course_id).name+' / '+f.due+' 前','followups/'+f.id,'gold')));
 if(!todo.children.length)todo.append(empty('待办已处理','所有任课单元已完成当前课前核对。'));
 right.append(panel('需要处理',todo,'todo-panel'));
 const recent=el('div');V.data.resources.slice(-3).reverse().forEach(r=>{const b=btn('',()=>readResource(r),'file-shortcut');b.append(ico('resources'),el('span','',r.title));recent.append(b);});right.append(panel('最近登记的资料',recent,'tinted-lilac'));
 layout.append(left,right);root.append(layout,section('本周课程一览',a('完整周历','calendar','text-link')),weekStrip());
}
function book(c){
 const n=el('article','course-book '+c.category);n.dataset.course=c.id;
 const cover=el('div','book-cover');cover.append(el('span','book-class',c.class_name),ico('courses'),el('h3','',c.name),el('span','book-teacher',teacher(c)));
 const body=el('div','book-body');body.append(el('p','book-time',when(c)),el('p','book-room',c.room+' · '+c.students+' 人次'),el('p','book-topic',c.topic));
 const status=el('div','book-status');status.append(chip(c.prepared?'课前已核对':missing(c)?'材料待补':'待核对',c.prepared?'mint':'coral'),el('span','',materials(c).length+' 份资料'));
 const links=el('div','book-links');links.append(a('进入课程','course/'+c.id,'book-link'),a('教学资料','course/'+c.id+'/materials','text-link'));
 body.append(status,links);n.append(cover,body);return n;
}
function metrics(){
 const cs=V.data.courses,covered=new Set(V.data.tasks.filter(t=>t.status==='submitted').map(t=>t.course_id)).size,n=el('div','metrics');
 [[cs.length,'开课单元','课程与教学班分别管理','blue','courses','courses'],[cs.filter(missing).length,'资料待补','查看缺少课前材料的开课','coral','courses?filter=missing','resources'],[covered+'/'+cs.length,'督导已覆盖','按已提交记录去重','mint','quality','quality'],[V.data.followups.filter(f=>f.status!=='closed').length,'进行中的跟进','查看教师回复与复核进度','gold','followups?status=active','feedback']].forEach(([v,l,copy,tone,href,icon])=>{const x=a('',href,'metric '+tone);x.append(ico(icon),el('span','metric-label',l),el('strong','',v),el('small','',copy));n.append(x);});return n;
}
function directorHome(){const root=$('#page');root.append(termline(),title('教学运行，总览与行动','先看需要处理的事项，再进入开课档案核对。',a('查看开课台账','courses','button primary')),metrics());const grid=el('div','director-layout'),left=el('div'),right=el('div');const matrix=el('div','quality-matrix');V.data.courses.forEach(c=>{const x=a('','course/'+c.id,'matrix-course '+(missing(c)?'needs':'complete'));x.append(el('span','',c.name),el('small','',c.class_name),chip(missing(c)?'课前材料待补':'资料已登记',missing(c)?'coral':'mint'));matrix.append(x);});left.append(panel('课程资料就绪情况',matrix));const actions=el('div');V.data.followups.filter(f=>f.status==='replied').forEach(f=>actions.append(taskRow('待复核：'+f.title,course(f.course_id).name,'followups/'+f.id,'mint')));V.data.courses.filter(missing).forEach(c=>actions.append(taskRow(c.name+' · 资料待补',c.class_name,'course/'+c.id+'/materials','coral')));if(!actions.children.length)actions.append(empty('暂无待处理事项','资料完整，当前没有待复核回复。'));right.append(panel('需要你处理',actions,'tinted-apricot'));const coverage=el('div','coverage-card'),covered=new Set(V.data.tasks.filter(t=>t.status==='submitted').map(t=>t.course_id)).size;coverage.append(el('strong','coverage-number',Math.round(covered/V.data.courses.length*100)+'%'),el('h3','','本学期督导覆盖'));const bar=el('progress');bar.max=V.data.courses.length;bar.value=covered;bar.setAttribute('aria-label',`覆盖${covered}个开课单元，共${V.data.courses.length}个`);coverage.append(bar,el('p','',`${covered} / ${V.data.courses.length} 个开课单元有已提交记录`),el('small','','统计本场景学期已登记记录，不推断名单以外的督导情况。'));right.append(coverage);grid.append(left,right);root.append(grid,section('最近教学跟进',a('全部跟进','followups','text-link')),followTable(V.data.followups));}
function supervisorHome(){
 const root=$('#page');root.append(termline(),title('每次听课，都有清晰的下一步','按日程准备材料、记录课堂观察，并跟进已提交的建议。',a('查看听课日历','calendar','button primary')));
 const pending=V.data.tasks.filter(t=>t.status!=='submitted'),completed=V.data.tasks.filter(t=>t.status==='submitted'),today=pending.filter(t=>t.date===V.data.as_of),head=el('div','observer-banner');
 const summary=el('div');summary.append(el('span','','听课安排'),el('strong','',today.length+' 项今日任务'),el('p','',pending.length+' 项待完成 · '+completed.length+' 份已提交'));
 const timeline=el('div','observer-timeline');pending.slice(0,3).forEach(t=>{const c=course(t.course_id),x=a('','observations/'+t.id,'visit-stop');x.append(el('b','',t.date===V.data.as_of?'今天 · '+slots[c.slot]:t.date.slice(5)+' · '+slots[c.slot]),el('strong','',c.name),el('small','',c.class_name+' / '+c.room));timeline.append(x);});if(!pending.length)timeline.append(el('p','','当前听课任务已全部提交。'));
 head.append(summary,timeline);root.append(head);
 const layout=el('div','supervisor-layout'),left=el('div'),right=el('aside');left.append(section('待完成的听课',a('全部任务','observations','text-link')));
 pending.forEach(t=>left.append(visitCard(t)));if(!pending.length)left.append(empty('暂无待完成任务','后续分配的听课会显示在这里。'));
 const archive=el('div');completed.slice().reverse().forEach(t=>archive.append(taskRow(course(t.course_id).name,t.date+' / '+course(t.course_id).class_name,'observations/'+t.id,'mint')));if(!completed.length)archive.append(el('p','muted','尚无已提交的听课记录。'));
 right.append(panel('已提交记录',archive,'tinted-lilac'));
 const follow=el('div');V.data.followups.filter(f=>f.status!=='closed').slice(0,3).forEach(f=>follow.append(taskRow(f.title,course(f.course_id).name,'followups/'+f.id,'gold')));if(follow.children.length)right.append(panel('建议后续进展',follow));
 layout.append(left,right);root.append(layout);
}
function visitCard(t){const c=course(t.course_id),n=a('','observations/'+t.id,'visit-card');n.append(el('div','visit-date'));n.firstChild.append(el('b','',t.date.slice(8)),el('span','',t.date.slice(5,7)+'月'));const copy=el('div','visit-copy');copy.append(el('h3','',c.name),el('p','',c.class_name+' / '+teacher(c)),el('small','',slots[c.slot]+' / '+c.room));n.append(copy,chip(({planned:t.date<V.data.as_of?'待补记录':'待听课',draft:'草稿',submitted:'已提交'})[t.status],t.status==='submitted'?'mint':'gold'),ico('arrow'));return n;}
function weekDates(){const d=new Date('2026-10-12T12:00:00');d.setDate(d.getDate()+7*V.week);return days.map((_,i)=>{const x=new Date(d);x.setDate(x.getDate()+i);return x.toISOString().slice(0,10);});}
function weekStrip(){const n=el('div','week-strip');const ds=weekDates();days.forEach((day,i)=>{const x=el('section','week-day'+(ds[i]===V.data.as_of?' today':''));x.append(el('h3','',day),el('small','',ds[i].slice(5)));V.data.courses.filter(c=>c.day===i).sort((a,b)=>a.slot-b.slot).forEach(c=>{const l=a('','course/'+c.id,'week-lesson '+c.category);l.append(el('small','',slots[c.slot]),el('strong','',c.name),el('span','',c.room));x.append(l);});if(!V.data.courses.some(c=>c.day===i))x.append(el('p','day-free','无排课'));n.append(x);});return n;}
function calendar(){const w=Number(routeParams().get('week')||0);V.week=Number.isInteger(w)?Math.max(-5,Math.min(10,w)):0;const root=$('#page'),ctrl=el('div','calendar-actions');const prev=btn('上一周',()=>{V.week--;calendarRender();}),next=btn('下一周',()=>{V.week++;calendarRender();});prev.disabled=V.week<=-5;next.disabled=V.week>=10;ctrl.append(prev,btn('回到本周',()=>{V.week=0;calendarRender();}),next);root.append(title(V.user.role==='supervisor'?'听课日历':'教学周历','常规排课按教学周展示；听课任务按指定日期展示。',ctrl));const ds=weekDates();root.append(el('p','calendar-range',`${ds[0]} 至 ${ds[4]} · 第${6+V.week}教学周`));if(V.user.role==='supervisor'){const n=el('div','week-strip');ds.forEach((date,i)=>{const col=el('section','week-day');col.append(el('h3','',days[i]),el('small','',date.slice(5)));const tasks=V.data.tasks.filter(t=>t.date===date);tasks.forEach(t=>{const c=course(t.course_id),l=a('','observations/'+t.id,'week-lesson '+c.category);l.append(el('small','',slots[c.slot]),el('strong','',c.name),chip(t.status==='submitted'?'已提交':'待完成',t.status==='submitted'?'mint':'gold'));col.append(l);});if(!tasks.length)col.append(el('p','day-free','无听课任务'));n.append(col);});root.append(n);}else root.append(weekStrip());root.append(el('p','footnote','课表为独立教学场景的常规安排，不代表东北大学实际校历或节假日调课结果。'));}
function calendarRender(){go('calendar'+(V.week?'?week='+V.week:''));}
function courseList(){V.query=routeParams().get('q')||'';V.filter=routeParams().get('filter')||'all';const root=$('#page');root.append(title(V.user.role==='teacher'?'我的任课课程':'开课档案','课程、教学班与任课关系分别管理，联合授课只计一次开课。'));const toolbar=el('div','toolbar'),q=input('搜索课程、教学班或教师',V.query,'search'),out=el('div');q.oninput=()=>{V.query=q.value;setParam('q',V.query);draw();};toolbar.append(q,select('开课状态',[['all','全部开课'],['missing','课前材料待补'],['unprepared','备课待核对']],V.filter,v=>{V.filter=v;setParam('filter',v);draw();}),btn('导出当前台账',()=>exportRows(filtered())));root.append(toolbar,out);function filtered(){return V.data.courses.filter(c=>[c.name,c.class_name,teacher(c)].join(' ').toLowerCase().includes(V.query.trim().toLowerCase())&&(V.filter!=='missing'||missing(c))&&(V.filter!=='unprepared'||!c.prepared));}function draw(){const cs=filtered();out.replaceChildren(el('p','result-count',cs.length+' 个开课单元'));if(!cs.length){out.append(empty('没有匹配的开课','更换搜索词或筛选条件。'));return;}out.append(table(['课程 / 教学班','任课教师','常规安排','人数','备课状态','操作'],cs.map(c=>{const name=el('div');name.append(a(c.name,'course/'+c.id,'table-title'),el('small','cell-sub',c.class_name));return[name,teacher(c),when(c),c.students+' 人次',chip(c.prepared?'已核对':'待核对',c.prepared?'mint':'gold'),a('进入课程','course/'+c.id,'text-link')];})));}draw();}
function exportRows(cs){const rows=[['课程','开课单元','教学班','任课教师','时间','教室','学生人次','数据性质'],...cs.map(c=>[c.name,c.id,c.class_name,teacher(c),when(c),c.room,c.students,'独立教学场景（非学校实际记录）'])];const esc=v=>'"'+String(v).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const l=el('a');l.href=url;l.download='爱教学_场景开课台账.csv';l.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出当前筛选台账');}
function coursePage(id,tab='overview'){const c=course(id),root=$('#page');if(!c){root.append(empty('该开课不可访问','请选择当前身份范围内的开课。'));return;}if(!['overview','materials','feedback'].includes(tab)){notFound('没有这个课程页签');return;}const context=el('div','course-context');context.append(a('返回'+routeLabel(originRoute()),originRoute(),'back-link'),select('切换开课单元',V.data.courses.map(x=>[x.id,x.name+' / '+x.class_name]),c.id,id=>go(a('','course/'+id+'/'+tab).hash.slice(2))));root.append(context);const hero=el('div','course-hero '+c.category),copy=el('div');copy.append(el('p','',c.class_name+' / '+c.id),el('h1','',c.name),el('p','',teacher(c)+' · '+c.students+' 人次 · '+c.weeks));hero.append(copy,el('div','course-hero-time'));hero.lastChild.append(ico('calendar'),el('strong','',when(c)),el('span','',c.room));root.append(hero);const tabs=el('nav','tabs');tabs.setAttribute('aria-label','课程内导航');for(const [id,label]of [['overview','课程概览'],['materials','教学资料'],['feedback','督导与反馈']]){const l=a(label,'course/'+c.id+'/'+id);if(id===tab)l.setAttribute('aria-current','page');tabs.append(l);}root.append(tabs);if(tab==='materials'){root.append(section('课程资料',own(c)?btn('新建课程资料',()=>resourceForm(c),'button primary'):V.user.role==='director'?btn('发起资料跟进',()=>followForm(c),'button primary'):null));materials(c).forEach(r=>root.append(resourceRow(r)));if(!materials(c).length)root.append(empty('尚无课程资料','本课教师可登记教学大纲、课前材料和课堂练习。'));return;}if(tab==='feedback'){root.append(section('已提交听课记录'));records(c).forEach(t=>root.append(reportView(t)));if(!records(c).length)root.append(empty('当前范围没有已提交记录','可能尚未开展、尚未提交或不在当前身份可见范围内，不能直接判断为未督导。'));root.append(section('教学跟进'));const fs=V.data.followups.filter(f=>f.course_id===c.id);fs.forEach(f=>root.append(followCard(f)));if(!fs.length)root.append(el('p','muted','暂无登记的跟进事项。'));return;}const layout=el('div','detail-layout'),main=el('div'),side=el('aside');const facts=el('dl','facts');for(const [l,v]of [['本周主题',c.topic],['教学班',c.class_name],['任课教师',teacher(c)],['常规时间',when(c)],['教学地点',c.room],['学生人次',c.students+'（场景值）']]){const row=el('div');row.append(el('dt','',l),el('dd','',v));facts.append(row);}main.append(panel('本周教学安排',facts));const preparation=el('div','preparation');preparation.append(chip(c.prepared?'课前已核对':'课前待核对',c.prepared?'mint':'gold'),el('p','',missing(c)?'本课尚缺课前材料，建议先补充内容。':'课前材料已登记，可继续核对教学目标与课堂安排。'));if(own(c)){preparation.append(btn(c.prepared?'重新打开备课':'确认课前准备完成',async()=>{try{await mutate('prepare',{course_id:c.id,prepared:!c.prepared});toast('备课状态已保存');}catch(e){toast(e.message);}},'button primary'),a('查阅课前材料','course/'+c.id+'/materials','text-link'));}else if(V.user.role==='director')preparation.append(btn('发起教学跟进',()=>followForm(c),'button primary'),btn('安排听课',()=>scheduleForm(c))); side.append(panel('课前准备',preparation,'tinted-apricot'));const origin=el('div');origin.append(el('p','', '课程名称参考东北大学公开课程名单。本页任课、班级、课表与材料均为独立教学场景。'),a('查阅公开课程来源','/public#/course/'+c.catalog_id,'text-link'));side.append(panel('课程来源',origin));main.append(section('课程资料',a('查看全部','course/'+c.id+'/materials','text-link')));materials(c).slice(0,3).forEach(r=>main.append(resourceRow(r)));layout.append(main,side);root.append(layout);}
function resourceRow(r){const row=el('article','resource-row'),mark=el('span','resource-icon');mark.append(ico('resources'));const copy=el('div','resource-copy');copy.append(btn(r.title,()=>readResource(r),'resource-title'),el('p','',`${r.kind} / ${who(r.author)} / ${r.created}`));row.append(mark,copy,btn('阅读',()=>readResource(r),'button small'));return row;}
function resourceHub(){const root=$('#page');root.append(title('教学资料工作台','按课程查阅已登记内容，教学大纲、课前材料与课堂练习分开管理。'));const tools=el('div','toolbar'),q=input('搜索资料名称或课程',routeParams().get('q')||'','search'),out=el('div');let chosen=routeParams().get('course')||'all';q.oninput=()=>{setParam('q',q.value);draw();};tools.append(q,select('所属课程',[['all','全部可见开课'],...V.data.courses.map(c=>[c.id,c.name+' / '+c.class_name])],chosen,v=>{chosen=v;setParam('course',v);draw();}));root.append(tools,out);function draw(){const rows=V.data.resources.filter(r=>(chosen==='all'||r.course_id===chosen)&&(r.title+' '+course(r.course_id).name).includes(q.value.trim()));out.replaceChildren(el('p','result-count',rows.length+' 份资料'));rows.forEach(r=>out.append(resourceRow(r)));if(!rows.length)out.append(empty('没有匹配资料','更换课程或搜索词。'));}draw();}
function modal(label,content){
 const previous=document.activeElement,d=el('dialog','modal'),head=el('div','modal-head'),h=el('h2','',label);h.id='modal-title-'+Date.now();d.setAttribute('aria-labelledby',h.id);
 d.requestClose=()=>d.close();head.append(h,btn('关闭',()=>d.requestClose(),'button small'));d.append(head,content);
 d.addEventListener('close',()=>{d.remove();if(previous?.isConnected)previous.focus();else $('#page').focus({preventScroll:true});});
 d.addEventListener('cancel',e=>{e.preventDefault();d.requestClose();});document.body.append(d);d.showModal();return d;
}
function readResource(r){const body=el('div','reading');body.append(chip(r.kind,'blue'),el('p','muted',who(r.author)+' / '+r.created),el('pre','document-body',r.body));modal(r.title,body);}
function formDialog(label,fields,action,base,submitLabel){
 const f=el('form','edit-form'),controls={};
 for(const spec of fields){
  const control=spec.options?select(spec.label,spec.options,spec.value||spec.options[0][0],()=>{}):spec.area?el('textarea'):input(spec.label,spec.value||'',spec.type||'text');
  if(spec.area){control.rows=spec.rows||4;control.value=spec.value||'';control.maxLength=spec.max||2000;}
  if(!spec.options){control.required=spec.required!==false;control.minLength=spec.min||1;control.maxLength=spec.max||2000;}
  if(spec.type==='date')control.min=V.data.as_of;
  control.name=spec.key;control.setAttribute('aria-label',spec.label);controls[spec.key]=control;
  const row=field(spec.label,control);if(spec.min)row.append(el('small','field-hint',`至少 ${spec.min} 个字符${spec.max?'，最多 '+spec.max+' 个':''}`));f.append(row);
 }
 const values=()=>Object.fromEntries(Object.entries(controls).map(([k,c])=>[k,c.value])),initial=JSON.stringify(values());
 const error=el('p','form-error');error.setAttribute('role','alert');const buttons=el('div','form-actions'),submit=el('button','button primary',submitLabel);submit.type='submit';buttons.append(submit);f.append(error,buttons);
 const d=modal(label,f);let saving=false;d.isDirty=()=>JSON.stringify(values())!==initial;
 d.requestClose=()=>{
  if(saving)return;
  if(!d.isDirty()){d.close();return;}
  if(d.querySelector('.discard-confirm'))return;
  const confirm=el('div','discard-confirm'),actions=el('div','form-actions');confirm.setAttribute('role','alert');confirm.append(el('strong','','内容尚未提交'),el('p','','关闭会丢弃本次输入。可以继续编辑，完成后再提交。'));
  const resume=btn('继续编辑',()=>{confirm.remove();Object.values(controls)[0].focus();},'button primary');actions.append(resume,btn('放弃未提交内容',()=>d.close()));confirm.append(actions);f.prepend(confirm);resume.focus();
 };
 buttons.append(btn('取消',()=>d.requestClose()));
 f.onsubmit=async e=>{
  e.preventDefault();saving=true;submit.disabled=true;submit.textContent='正在提交…';
  try{await mutate(action,{...base,...values()});d.close();toast('已保存，相关工作台已同步更新');}
  catch(err){error.textContent=err.message;error.tabIndex=-1;error.focus();if(err.status===409&&!buttons.querySelector('[data-refresh]')){const b=btn('刷新业务状态并保留输入',async()=>{try{await refresh();error.textContent='已读取最新状态，请核对后重新提交。';}catch(e){error.textContent=e.message;}});b.dataset.refresh='true';buttons.append(b);}}
  finally{saving=false;submit.disabled=false;submit.textContent=submitLabel;}
 };return d;
}
function resourceForm(c){formDialog('新建课程资料 · '+c.name,[{key:'title',label:'资料标题',min:2,max:80},{key:'kind',label:'资料类型',options:[['课前材料','课前材料'],['教学大纲','教学大纲'],['课堂练习','课堂练习']]},{key:'body',label:'资料正文',area:true,rows:10,min:20,max:12000}],'resource_add',{course_id:c.id},'发布到场景课程');}
function followForm(c){formDialog('发起跟进 · '+c.name,[{key:'title',label:'跟进事项',min:2,max:80},{key:'description',label:'具体要求',area:true,min:10},{key:'due',label:'截止日期',type:'date',value:'2026-10-19'}],'followup_create',{course_id:c.id},'发起跟进');}
function followTable(fs){return table(['事项','课程 / 教学班','截止日期','状态','操作'],fs.map(f=>[f.title,course(f.course_id).name+' / '+course(f.course_id).class_name,f.due,chip(({open:'待教师回复',replied:'待主任复核',closed:'已关闭'})[f.status],f.status==='closed'?'mint':f.status==='replied'?'blue':'gold'),a('处理事项','followups/'+f.id,'text-link')]));}
function followCard(f){const c=course(f.course_id),n=el('article','follow-card');n.id=f.id;const top=el('div','follow-top');top.append(el('h3','',f.title),chip(({open:'待教师回复',replied:'待主任复核',closed:'已关闭'})[f.status],f.status==='closed'?'mint':'gold'));n.append(top,el('p','muted',c.name+' / '+c.class_name+' / '+f.due+' 前'),el('p','follow-description',f.description));if(f.reply){const r=el('div','reply-block');r.append(el('strong','','教师回复'),el('p','',f.reply));n.append(r);}if(f.resolution){const r=el('div','reply-block resolved');r.append(el('strong','','主任复核'),el('p','',f.resolution));n.append(r);}if(own(c)&&f.status==='open')n.append(btn('回复处理情况',()=>formDialog('回复：'+f.title,[{key:'reply',label:'处理情况与结果',area:true,min:10}],'followup_reply',{course_id:c.id,followup_id:f.id},'提交回复'),'button primary'));if(V.user.role==='director'&&f.status==='replied')n.append(btn('复核并关闭',()=>formDialog('复核：'+f.title,[{key:'resolution',label:'复核结论',area:true,min:10}],'followup_close',{course_id:c.id,followup_id:f.id},'确认关闭'),'button primary'));return n;}
function followups(id){
 const root=$('#page');if(id&&!V.data.followups.some(f=>f.id===id)){notFound('该跟进事项不可访问','请在当前身份可见的跟进列表中选择。');return;}
 root.append(title(V.user.role==='teacher'?'教学反馈与改进':'教学改进跟进','教师回复处理结果，主任核实后关闭；每一步都保留上下文。'));
 const tools=el('div','toolbar'),out=el('div');let status=id?'all':routeParams().get('status')||'all';
 tools.append(select('跟进状态',[['all','全部事项'],['active','进行中'],['open','待教师回复'],['replied','待主任复核'],['closed','已关闭']],status,v=>{status=v;setParam('status',v);draw();}));root.append(tools,out);
 function draw(){const fs=V.data.followups.filter(f=>status==='all'||status==='active'&&f.status!=='closed'||f.status===status);out.replaceChildren(el('p','result-count',fs.length+' 项跟进'));fs.forEach(f=>out.append(followCard(f)));if(!fs.length)out.append(empty('暂无此状态的事项','更换筛选条件查看其他跟进。'));}draw();
 if(id){document.getElementById(id)?.classList.add('selected-followup');requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({block:'center'}));}
}
function reportView(t){const c=course(t.course_id),n=el('section','report-view');n.append(el('h3','',c.name+' · '+t.date+' 听课记录'),el('p','muted',who(t.observer)+' / '+c.class_name+' / 已提交'));for(const [k,label]of [['organization','教学组织'],['content','内容呈现'],['interaction','课堂互动'],['suggestion','改进建议']])n.append(el('h4','',label),el('p','',t.report[k]||'未填写'));return n;}
function observations(id){
 const root=$('#page');if(V.user.role!=='supervisor'){notFound('此页面用于督导听课任务','教师可在课程中查看已提交反馈，主任可进入教学核查。');return;}
 if(id&&!V.data.tasks.some(t=>t.id===id)){notFound('该听课任务不可访问','请从听课任务列表重新选择。');return;}
 root.append(title('听课任务与记录','草稿仅自己可见。正式提交后，任课教师与主任可以查阅。'));
 const t=V.data.tasks.find(t=>t.id===id)||V.data.tasks.find(t=>t.status!=='submitted')||V.data.tasks[0],layout=el('div','observation-layout'),index=el('aside','visit-index'),main=el('div','observation-editor');
 V.data.tasks.forEach(x=>{const l=a('','observations/'+x.id,'visit-index-item');l.append(el('small','',x.date+' / '+slots[course(x.course_id).slot]),el('strong','',course(x.course_id).name),el('small','',course(x.course_id).class_name),chip(({planned:'待填写',draft:'草稿',submitted:'已提交'})[x.status],x.status==='submitted'?'mint':'gold'));if(t?.id===x.id)l.setAttribute('aria-current','page');index.append(l);});layout.append(index,main);root.append(layout);
 if(!t){main.append(empty('暂无听课任务','当前身份尚未分配听课任务。'));return;}
 const c=course(t.course_id);main.append(section(c.name,a('查阅课程材料','course/'+c.id+'/materials','text-link')),el('p','muted',`${t.date} / ${slots[c.slot]} / ${c.class_name} / ${c.room}`));
 const key='aijiaoxue:observation:'+V.user.id+':'+t.id;
 if(t.status==='submitted'){V.draftMemory.delete(key);V.draftFallback.delete(key);try{sessionStorage.removeItem(key);}catch{}main.append(reportView(t));return;}
 const f=el('form','observation-form'),fields={},draftNote=el('div','draft-status');draftNote.setAttribute('role','status');
 let cached=V.draftMemory.get(key)||null;try{cached=JSON.parse(sessionStorage.getItem(key)||'null')||cached;}catch{}
 const restore=cached&&cached.values&&typeof cached.values==='object';let dirty=!!restore;
 for(const [k,label,placeholder]of [['organization','教学组织','记录环节衔接、节奏与时间分配。'],['content','内容呈现','记录教学目标、概念解释与案例。'],['interaction','课堂互动','记录提问、讨论和学生表达的事实。'],['suggestion','改进建议','写清具体行动及预期改善。']]){
  const x=el('textarea');x.rows=4;x.maxLength=2000;x.value=restore?String(cached.values[k]||''):t.report[k]||'';x.placeholder=placeholder;x.setAttribute('aria-label',label);fields[k]=x;
  const row=field(label,x),hint=el('small','field-hint'),err=el('small','field-error');err.id='error-'+k;hint.id='hint-'+k;x.setAttribute('aria-describedby',hint.id+' '+err.id);row.append(hint,err);f.append(row);
  const count=()=>hint.textContent=x.value.trim().length+' / 2000 字符 · 正式提交至少 10 个';count();
  x.oninput=()=>{count();err.textContent='';x.removeAttribute('aria-invalid');dirty=true;stash();};
 }
 const values=()=>Object.fromEntries(Object.entries(fields).map(([k,x])=>[k,x.value]));
 function stash(){const snapshot={values:values(),base:t.report,at:Date.now()};V.draftMemory.set(key,snapshot);try{sessionStorage.setItem(key,JSON.stringify(snapshot));V.draftFallback.delete(key);V.unsavedFallback=false;draftNote.textContent='输入已暂存在当前浏览器页签，尚未保存到服务器。';}catch{V.draftFallback.add(key);V.unsavedFallback=true;draftNote.textContent='浏览器暂存不可用，请先保存草稿再离开。';}}
 draftNote.textContent=restore?'已恢复本页暂存内容，保存草稿后才会写入服务器。':t.status==='draft'?'已载入服务器草稿，可继续编辑。':'尚未填写，内容仅在正式提交后向教师与主任开放。';
 if(restore&&JSON.stringify(cached.base)!==JSON.stringify(t.report))draftNote.textContent='服务器草稿已有变化；已保留本页输入，请核对后保存。';
 main.append(draftNote);
 const error=el('p','form-error');error.setAttribute('role','alert');const actions=el('div','form-actions'),draft=btn('保存草稿',()=>send(false)),submit=btn('提交听课记录',()=>send(true),'button primary');actions.append(draft,submit);
 const future=t.date>V.data.as_of;if(future){submit.disabled=true;submit.title='听课日期尚未到达';}
 actions.append(btn('恢复服务器版本',()=>{if(dirty&&!window.confirm('这会放弃本页未保存输入，恢复服务器中的内容。是否继续？'))return;V.draftMemory.delete(key);V.draftFallback.delete(key);try{sessionStorage.removeItem(key);}catch{}V.unsavedFallback=false;render();},'button quiet'));
 f.append(error,actions,el('p','footnote',future?'尚未到听课日期，可先记录准备内容并保存草稿。':'提交后不可在此修改。提交前请检查四项记录是否完整、客观。'));main.append(f);
 async function send(final){
  error.textContent='';let first=null;
  if(final)for(const [k,x]of Object.entries(fields)){const invalid=x.value.trim().length<10;$('#error-'+k).textContent=invalid?'请至少填写 10 个字符，描述具体观察或建议。':'';if(invalid){x.setAttribute('aria-invalid','true');first=first||x;}}
  if(first){error.textContent='提交前请完整填写四项内容，每项至少10个字符。';first.focus();return;}
  V.writing=true;$('#identity').disabled=true;draft.disabled=submit.disabled=true;const clicked=final?submit:draft,original=clicked.textContent;clicked.textContent=final?'正在提交…':'正在保存…';
  try{
   const d=await request('action',{action:final?'report_submit':'report_save',version:V.version,course_id:c.id,task_id:t.id,...values()});
   V.draftMemory.delete(key);V.draftFallback.delete(key);try{sessionStorage.removeItem(key);}catch{}dirty=false;V.unsavedFallback=false;apply(d);render();toast(final?'听课记录已提交':'草稿已保存到服务器');
  }catch(e){error.textContent=e.message;if(e.status===409&&!actions.querySelector('[data-refresh]')){const b=btn('刷新状态并保留草稿',async()=>{try{apply(await request('state'));stash();error.textContent='已读取最新业务状态，请核对后重新保存或提交。';}catch(e){error.textContent=e.message;}});b.dataset.refresh='true';actions.append(b);}}
  finally{V.writing=false;$('#identity').disabled=false;draft.disabled=false;submit.disabled=future;clicked.textContent=original;}
 }
}
function quality(){const root=$('#page');if(V.user.role!=='director'){root.append(empty('此页面用于主任教学核查','请从当前身份导航进入可用工作页面。'));return;}root.append(title('教学核查台账','资料就绪、课前核对与督导覆盖分别呈现，不把一个状态代替另一个。'),metrics());root.append(table(['开课单元','课前材料','课前核对','督导记录','跟进'],V.data.courses.map(c=>[a(c.name+' / '+c.class_name,'course/'+c.id,'table-title'),chip(missing(c)?'待补充':'已登记',missing(c)?'coral':'mint'),chip(c.prepared?'已核对':'待核对',c.prepared?'mint':'gold'),records(c).length?records(c).length+' 条已提交':'当前登记范围无已提交记录',courseActions(c)])));root.append(section('已提交的听课反馈'));V.data.tasks.filter(t=>t.status==='submitted').forEach(t=>root.append(reportView(t)));}
function showSearch(){
 const body=el('div','search-body'),q=input('课程、班级、资料名称','','search'),out=el('div','search-results');body.append(q,out);const d=modal('搜索课程与资料',body);
 function draw(){const s=q.value.trim().toLowerCase(),items=[...V.data.courses.map(c=>({label:c.name,sub:c.class_name+' / '+teacher(c),route:'course/'+c.id,type:'courses'})),...V.data.resources.map(r=>({label:r.title,sub:r.kind+' / '+course(r.course_id).class_name,resource:r,type:'resources'}))].filter(x=>(x.label+' '+x.sub).toLowerCase().includes(s));out.replaceChildren(el('p','result-count',`${items.length} 个结果${items.length>12?'，显示前12项':''}`));items.slice(0,12).forEach(x=>{const b=btn('',()=>{d.close();if(x.resource)readResource(x.resource);else go(a('',x.route).hash.slice(2));},'search-result'),copy=el('span');copy.append(el('strong','',x.label),el('small','',x.sub));b.append(ico(x.type),copy,ico('arrow'));out.append(b);});if(!items.length)out.append(el('p','search-empty','没有匹配内容。尝试课程名称、教学班或资料关键词。'));}
 q.oninput=draw;body.onkeydown=e=>{if(!['ArrowDown','ArrowUp'].includes(e.key))return;e.preventDefault();const list=[q,...out.querySelectorAll('button')],i=list.indexOf(document.activeElement);list[(i+(e.key==='ArrowDown'?1:list.length-1))%list.length].focus();};draw();q.focus();
}
function about(){const body=el('div','about-copy');body.append(el('h3','','公开资料与教学场景分开保存'),el('p','','课程名称和原始目录来自东北大学教务处的公开课程名单，可从课程详情查看来源。当前任课姓名、教学班、人数、排课、资料正文、听课记录和跟进事项均为独立场景数据，并非东北大学实际教学记录。'),el('h3','','能完成哪些工作'),el('p','','教师可发布本课资料、确认备课、回复跟进；督导可保存草稿并提交分配给自己的听课记录；主任可发起跟进、复核教师回复。操作保存到本地服务的SQLite数据库，刷新和服务重启后仍保留。'),el('h3','','使用范围'),el('p','','场景身份切换用于本地课程项目演示，不是学校统一身份认证。跨身份写入由服务器校验，但本版本不应直接开放为真实学校生产系统。场景日期固定为2026年10月15日，操作日志保留实际操作时间。'),a('打开真实公开课程目录','/public#/catalog','button'));modal('数据来源与运行说明',body);}
function render(){if(!V.data)return;V.unsavedFallback=false;nav();$('#page').replaceChildren();$('#network').textContent='';const [r,id,tab]=currentRoute();if(r==='courses')courseList();else if(r==='course')coursePage(id,tab);else if(r==='calendar')calendar();else if(r==='resources')resourceHub();else if(r==='observations')observations(id);else if(r==='followups')followups(id);else if(r==='quality')quality();else if(r!=='home')notFound();else if(V.user.role==='teacher')teacherHome();else if(V.user.role==='director')directorHome();else supervisorHome();$('#page').setAttribute('aria-busy','false');}
async function init(){try{const b=await request('bootstrap');V.users=b.users;$('#identity').replaceChildren();V.users.forEach(u=>{const o=el('option','',u.name+' · '+roleNames[u.role]);o.value=u.id;$('#identity').append(o);});if(!b.user)await request('session',{user_id:'t1'});apply(await request('state'));$('#identity').disabled=false;render();}catch(e){$('#page').replaceChildren(empty('暂时无法读取工作空间',e.message),btn('重新连接',init,'button primary'));$('#page').setAttribute('aria-busy','false');}}
$('#identity').onchange=e=>changeUser(e.target.value);$('#search').onclick=()=>V.data&&showSearch();$('#about').onclick=about;window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);$('#page').focus({preventScroll:true});});window.addEventListener('beforeunload',e=>{if(V.unsavedFallback||V.draftFallback.size||document.querySelector('dialog')?.isDirty?.()){e.preventDefault();e.returnValue='';}});window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&V.data){e.preventDefault();if(!document.querySelector('dialog[open]'))showSearch();}});$('.skip').onclick=e=>{e.preventDefault();$('#page').focus();};init();

function scheduleForm(c){const date=new Date(V.data.as_of+'T12:00:00');const delta=(c.day-(date.getDay()+6)%7+7)%7;date.setDate(date.getDate()+delta);formDialog('安排听课 · '+c.name,[{key:'date',label:'听课日期（'+days[c.day]+'，督导：许文清）',type:'date',value:date.toISOString().slice(0,10)}],'observation_create',{course_id:c.id},'安排听课任务');}
function courseActions(c){const n=el('div','course-actions');n.append(btn('跟进',()=>followForm(c),'button small'),btn('安排听课',()=>scheduleForm(c),'button small'));return n;}
