"use strict";

// 所有动态文本通过textContent写入；服务端负责授权，界面只呈现查询结果。
const $ = (selector) => document.querySelector(selector);
const state = {user: null, identityReady: false, offerings: [], selected: null, tab: "resources", summaryStatus: "idle", epoch: 0, controller: null};
const resourceViews = new Map();
let previewController = null;
let previewTrigger = null;
const roleNames = {teacher: "教师", director: "主任", supervisor: "督导"};
const roleProfiles = {
  teacher: {scope: "仅显示本人承担的开课", directory: "我的开课", task: "查看本人课程安排与关联教学资源。", tabs: ["resources"], initialTab: "resources", tools: [["offerings", "我的开课"], ["arrangement", "课程安排"], ["resources", "教学资源"]]},
  director: {scope: "仅显示计算机系授权开课", directory: "系内开课", task: "查阅系内开课、教学资源与已登记督导事实。", tabs: ["supervision", "resources"], initialTab: "supervision", tools: [["offerings", "系内开课"], ["supervision", "督导记录"], ["resources", "教学资源"]]},
  supervisor: {scope: "仅显示计算机系授权开课", directory: "督导范围内的开课", task: "按具体开课查阅督导登记及其事实来源。", tabs: ["supervision", "resources"], initialTab: "supervision", tools: [["offerings", "授权开课"], ["supervision", "督导记录"], ["sources", "事实来源"]]}
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function api(url, options = {}) {
  const response = await fetch(url, {credentials: "same-origin", ...options});
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "请求未成功，请重试。");
  return data;
}

function requestMessage(error) {
  return error instanceof TypeError
    ? "本地服务没有响应，请检查服务运行状态后重试。"
    : (error.message || "请求未完成，请重试。");
}

function notice(message = "") {
  $("#notice").textContent = message;
  $("#notice").classList.toggle("hidden", !message);
}

function empty(title, text) {
  const box = el("div", "empty");
  box.append(el("h3", "", title), el("p", "", text));
  return box;
}

function beginQuery() {
  closeReader();
  if (state.controller) state.controller.abort();
  state.controller = new AbortController();
  state.epoch += 1;
  return {epoch: state.epoch, signal: state.controller.signal};
}

function visibleOfferings() {
  const search = $('#search').value.trim().toLocaleLowerCase();
  const mode = $('#teaching-filter').value;
  const items = state.offerings.filter(o => {
    const haystack = [o.id, o.course.code, o.course.name, o.class_name, ...o.teachers].join(' ').toLocaleLowerCase();
    return (!search || haystack.includes(search)) && (mode === 'all' || (mode === 'joint' ? o.teacher_ids.length > 1 : o.teacher_ids.length === 1));
  });
  const sort = $('#sort').value;
  const key = o => sort === 'course' ? o.course.name : sort === 'class' ? o.class_name : o.id;
  return items.sort((a,b) => key(a).localeCompare(key(b), 'zh-CN', {numeric:true}) || a.id.localeCompare(b.id));
}

function renderScopeSnapshot() {
  const ready = state.identityReady && state.summaryStatus === 'ready';
  for (const id of ['search','teaching-filter','sort']) $('#' + id).disabled = !ready;
  $('#result-caption').textContent = ready ? `授权范围 ${state.offerings.length} 条开课` : state.summaryStatus === 'loading' ? '正在查询' : state.summaryStatus === 'error' ? '查询未完成' : '等待查询';
}

function renderList() {
  const list = $('#offering-list');
  list.replaceChildren();
  $('#list-name').textContent = state.user ? roleProfiles[state.user.role].directory : '可查开课';
  const items = visibleOfferings();
  $('#offering-count').textContent = state.identityReady && state.summaryStatus === 'ready' ? items.length : '—';
  if (!state.identityReady) {
    list.append(empty('先选择模拟身份', '确认身份后，页面会按对应范围查询开课。'));
    return;
  }
  if (!items.length) {
    if (state.offerings.length) {
      list.append(empty('没有匹配的开课', '尝试其他关键词，或清除搜索与授课方式筛选。'));
      const clear = el('button', 'retry', '清除筛选');
      clear.addEventListener('click', () => { $('#search').value = ''; $('#teaching-filter').value = 'all'; applyFilters(); });
      list.append(clear);
    } else list.append(empty('当前范围没有开课', '请更换学期或选择其他模拟身份。'));
    return;
  }
  const directory = el('div', 'course-directory');
  for (const offering of items) {
    const selected = offering.id === state.selected;
    const button = el('button', 'offering' + (selected ? ' selected' : ''));
    button.type = 'button'; button.dataset.offering = offering.id;
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', `${offering.course.name}，${offering.class_name}，开课 ${offering.id}`);
    button.append(el('span','course-code',`${offering.course.code} / ${offering.id}`), el('strong','course-name',offering.course.name), el('span','course-class',offering.class_name));
    const bottom = el('span','course-teachers',offering.teachers.join(' / ') || '任课教师未登记');
    if(offering.teacher_ids.length > 1) bottom.append(el('span','joint-label','联合'));
    button.append(bottom);
    button.addEventListener('click', () => selectOffering(offering));
    directory.append(button);
  }
  list.append(directory);
}

async function applyFilters() {
  if (state.summaryStatus !== 'ready') return;
  const items = visibleOfferings();
  if (!items.length) {
    beginQuery(); state.selected = null; renderList();
    $('#detail').setAttribute('aria-busy','false');
    $('#detail').replaceChildren(empty('没有选中的开课', '调整搜索或筛选后，再查看开课详情。'));
  } else if (!items.some(o => o.id === state.selected)) await selectOffering(items[0]);
  else { renderList(); updatePosition(); }
}

function retryButton(container, label, action) {
  const button = el('button', 'retry', label);
  button.type = 'button'; button.addEventListener('click', action); container.append(button);
}

function roleActionIcon(action) {
  const drawings = {
    offerings: ["M5 4.5h11.5v13H7.2a2.2 2.2 0 0 1 0-4.4h9.3", "M8.5 8h5.5", "M8.5 11h5.5"],
    arrangement: ["M4.5 6.5h11v10h-11z", "M7.5 4.5v4", "M12.5 4.5v4", "M4.5 9.5h11"],
    resources: ["M6 3.8h7l3 3v9.5H6z", "M13 3.8v3h3", "M8.5 10h5", "M8.5 13h5"],
    supervision: ["M7 4.5h8.5v12H5.5v-10", "M8 8l1.5 1.5L12 7", "M8 13h4.5", "M4 4.5h5"],
    sources: ["M8 12l4-4", "M7 8H5.5a3 3 0 0 0 0 6h3", "M13 10h1.5a3 3 0 0 0 0-6h-3", "M13.5 3.5h3v3"]
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const d of drawings[action] || []) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

async function loadOfferings() {
  if (!state.identityReady || !state.user) {
    state.offerings = [];
    state.selected = null;
    state.summaryStatus = "idle";
    renderScopeSnapshot();
    renderList();
    $("#detail").replaceChildren(empty("开课详情", "确认模拟身份并查询后，选择一条开课查看关联信息。"));
    return;
  }
  const query = beginQuery();
  state.selected = null;
  state.offerings = [];
  state.summaryStatus = "loading";
  renderScopeSnapshot();
  notice();
  $("#offering-count").textContent = "…";
  $("#offering-list").setAttribute("aria-busy", "true");
  $("#offering-list").replaceChildren(el("p", "loading-label", "正在读取当前身份与学期范围…"), ...Array.from({length:3}, () => { const row = el("div", "skeleton-row"); row.setAttribute("aria-hidden", "true"); return row; }));
  $("#detail").replaceChildren(empty("选择一条开课", "课程、资源与督导记录会随选择同步更新。"));
  try {
    const data = await api("/api/offerings?term_id=" + encodeURIComponent($("#term").value), {signal: query.signal});
    if (query.epoch !== state.epoch) return;
    state.offerings = data.items;
    state.summaryStatus = "ready";
    renderScopeSnapshot();
    renderList();
    $("#offering-list").setAttribute("aria-busy", "false");
    if (state.offerings.length) await applyFilters();
    else $("#detail").replaceChildren(empty("当前范围没有开课", "更换学期或模拟身份后继续查询。"));
  } catch (error) {
    if (error.name === "AbortError" || query.epoch !== state.epoch) return;
    state.summaryStatus = "error";
    renderScopeSnapshot();
    $("#offering-count").textContent = "—";
    $("#offering-list").replaceChildren(empty("开课暂不可用", "本次查询没有完成，请重试。"));
    notice(requestMessage(error));
    const retry = el("button", "retry", "重新查询");
    retry.addEventListener("click", loadOfferings);
    $("#offering-list").append(retry);
  } finally {
    if (query.epoch === state.epoch) $("#offering-list").setAttribute("aria-busy", "false");
  }
}

async function selectOffering(offering) {
  if (!state.identityReady) return;
  const query = beginQuery();
  state.selected = offering.id;
  renderList();
  notice();
  $("#detail").setAttribute("aria-busy", "true");
  $("#detail").replaceChildren(empty("正在加载开课", "正在核对课程与开课关系…"));
  try {
    const detail = await api(`/api/offerings/${offering.id}?course_id=${offering.course_id}`, {signal: query.signal});
    if (query.epoch !== state.epoch) return;
    renderDetail(detail);
    syncRoleTools();
    await loadTab(detail, query);
  } catch (error) {
    if (error.name === "AbortError" || query.epoch !== state.epoch) return;
    $("#detail").replaceChildren(empty("开课暂不可用", requestMessage(error)));
    retryButton($("#detail"), "重试开课详情", () => selectOffering(offering));
  } finally {
    if (query.epoch === state.epoch) $("#detail").setAttribute("aria-busy", "false");
  }
}

function renderDetail(detail) {
  const root = $("#detail");
  root.replaceChildren();
  const head = el("div", "detail-head");
  head.tabIndex = -1;
  head.append(el("p", "eyebrow", `${detail.course.code} / ${detail.id}`), el("h2", "", detail.course.name), el("p", "", detail.term));
  const meta = el("div", "detail-meta");
  meta.append(el("span", "", detail.course.department), el("span", "", `${detail.course.credits} 学分`), el("span", "", detail.class_name));
  head.append(meta);
  const controls = el('div','course-controls');
  const items = visibleOfferings(), position = items.findIndex(o => o.id === detail.id);
  for (const [offset,label] of [[-1,'上一开课'],[1,'下一开课']]) {
    const move = el('button','quiet-button',label); move.type = 'button'; move.disabled = !items[position+offset];
    move.dataset.step = String(offset);
    move.addEventListener('click', async () => {
      const current = visibleOfferings(), i = current.findIndex(o=>o.id===state.selected), next=current[i+offset];
      if(next) { await selectOffering(next); document.querySelector(`[data-step="${offset}"]:not(:disabled)`)?.focus(); }
    });
    controls.append(move);
  }
  controls.append(el('span','position-label',`筛选结果 ${position+1} / ${items.length}`));
  head.append(controls);
  const body = el("div", "detail-body");
  const overview = el('details','course-overview'); overview.open = true;
  const summary = el('summary','','课程简介与开课安排');
  overview.append(summary, el('p','description',detail.course.description || '课程简介未提供。'));
  const facts = el('dl','facts');
  for (const [label,value] of [['任课教师',detail.teachers.join(' / ') || '未登记'],['教学班',detail.class_name],['教学时间',detail.schedule],['教学地点',detail.room]]) {
    const fact=el('div'); fact.append(el('dt','',label),el('dd','',value || '未登记')); facts.append(fact);
  }
  overview.append(facts); body.append(overview);
  const tabs = el("div", "tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "关联信息");
  const tabLabels = {resources: "教学资源", supervision: "督导记录"};
  for (const id of roleProfiles[state.user.role].tabs) {
    const text = tabLabels[id];
    const tab = el("button", "tab" + (state.tab === id ? " active" : ""), text);
    tab.id = "tab-" + id;
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(state.tab === id));
    tab.setAttribute("aria-controls", "tab-content");
    tab.tabIndex = state.tab === id ? 0 : -1;
    tab.addEventListener("click", () => {
      state.tab = id;
      const query = beginQuery();
      for (const t of tabs.children) {
        const selected = t === tab;
        t.classList.toggle("active", selected);
        t.setAttribute("aria-selected", String(selected));
        t.tabIndex = selected ? 0 : -1;
      }
      syncRoleTools();
      loadTab(detail, query);
    });
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const all = [...tabs.children], index = all.indexOf(tab);
      const target = event.key === "Home" ? all[0] : event.key === "End" ? all.at(-1) : all[(index + (event.key === "ArrowRight" ? 1 : -1) + all.length) % all.length];
      target.click();
      target.focus();
    });
    tabs.append(tab);
  }
  const content = el("div", "tab-content");
  content.id = "tab-content";
  content.setAttribute("role", "tabpanel");
  body.append(tabs, content);
  root.append(head, body);
}

function link(text, url, className = "") {
  const a = el("a", className, text);
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.setAttribute("aria-label", text + "（新窗口）");
  return a;
}

async function loadTab(detail, query) {
  const content = $("#tab-content");
  $("#detail").setAttribute("aria-busy", "true");
  content.setAttribute("aria-labelledby", "tab-" + state.tab);
  content.replaceChildren(empty("正在加载", "正在查询本次开课的关联信息…"));
  const tab = state.tab;
  try {
    const data = await api(`/api/offerings/${detail.id}/${tab}`, {signal: query.signal});
    if (query.epoch !== state.epoch) return;
    content.replaceChildren();
    if (tab === "resources") {
      renderResources(content, data.items, detail);
    } else {
      content.append(el("div", "data-note", "数据状态：" + data.data_state + "。" + data.notice));
      if (!data.records.length) content.append(empty("未查询到督导记录", "请结合上方数据状态理解结果，不据此推断从未督导。"));
      const timeline = el("div", "record-timeline");
      for (const record of data.records) {
        const card = el("article", "resource");
        card.dataset.record = record.id;
        const heading = el("div", "record-heading");
        const date = el("time", "record-date", record.date);
        date.dateTime = record.date;
        heading.append(date, el("span", "record-kind", record.observer));
        card.append(heading, el("h4", "record-title", record.summary), el("p", "", `开课 ${record.offering_id} · ${record.id} · 来源：${record.source}`), link("查阅事实来源", record.source_url, "source-link"));
        timeline.append(card);
      }
      if (data.records.length) content.append(timeline);
    }
  } catch (error) {
    if (error.name === "AbortError" || query.epoch !== state.epoch) return;
    content.replaceChildren(empty("暂无法查阅", requestMessage(error)));
    retryButton(content, "重试关联信息", () => loadTab(detail, beginQuery()));
  } finally {
    if (query.epoch === state.epoch) $("#detail").setAttribute("aria-busy", "false");
  }
}

function setScope(user) {
  const profile = roleProfiles[user.role];
  document.body.dataset.role = user.role;
  state.tab = profile.initialTab;
  resourceViews.clear();
  setFocusMode(false);
  $("#role-mark").textContent = roleNames[user.role] + "视角";
  $("#scope-title").textContent = profile.scope;
  $("#role-task").textContent = profile.task;
  $("#scope-detail").textContent = "角色权限按本地模拟规则控制。";
  renderRoleTools(user);
}

function renderRoleTools(user) {
  const root = $("#role-tools");
  root.replaceChildren();
  for (const [action, label] of roleProfiles[user.role].tools) {
    const button = el("button", "role-tool");
    button.append(roleActionIcon(action), document.createTextNode(label));
    button.type = "button";
    button.dataset.roleAction = action;
    button.addEventListener("click", () => {
      if (action === "offerings") {
        setFocusMode(false);
        $("#offering-list").scrollIntoView({behavior: "smooth", block: "start"});
        $(".offering")?.focus();
        return;
      }
      if (action === "arrangement") {
        if (!state.selected) {
          notice("请先从左侧目录选择一条开课，再查看课程安排。");
          setFocusMode(false);
        $("#offering-list").scrollIntoView({behavior: "smooth", block: "start"});
          $(".offering")?.focus();
          return;
        }
        const overview = $(".course-overview"); if(overview) overview.open = true;
        $(".detail-head")?.scrollIntoView({behavior: "smooth", block: "start"});
        $(".detail-head")?.focus();
        return;
      }
      const tabId = action === "sources" ? "supervision" : action;
      const tab = $("#tab-" + tabId);
      if (!state.selected || !tab) {
        notice("请先从左侧目录选择一条开课，再查看关联信息。");
        setFocusMode(false);
        $("#offering-list").scrollIntoView({behavior: "smooth", block: "start"});
        $(".offering")?.focus();
        return;
      }
      if (state.tab !== tabId) tab.click();
      const target = action === "sources" ? $(".source-link") || $("#tab-content") : $("#tab-content");
      target?.scrollIntoView({behavior: "smooth", block: "center"});
      target?.focus?.();
    });
    root.append(button);
  }
}

async function switchIdentity() {
  beginQuery();
  setFocusMode(false);
  resourceViews.clear();
  const identity = $("#identity");
  const term = $("#term");
  if (!identity.value) return;
  const requestedIdentity = identity.value;
  $("#search").value = ""; $("#teaching-filter").value = "all"; $("#sort").value = "id";
  identity.disabled = true;
  term.disabled = true;
  state.identityReady = false;
  state.user = null;
  document.body.dataset.role = "";
  state.summaryStatus = "idle";
  renderScopeSnapshot();
  $("#role-tools").replaceChildren();
  state.offerings = [];
  state.selected = null;
  $("#scope-title").textContent = "正在确认模拟身份";
  $("#role-mark").textContent = "身份确认中";
  $("#role-task").textContent = "确认前不会查询或显示开课数据。";
  $("#scope-detail").textContent = "确认前不会查询或显示开课数据。";
  $("#offering-list").setAttribute("aria-busy", "true");
  renderList();
  $("#detail").setAttribute("aria-busy", "true");
  $("#detail").replaceChildren(empty("正在确认模拟身份", "正在核对本次演示可见范围…"));
  notice();
  let confirmed = false;
  try {
    const data = await api("/api/demo-session", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({user_id: identity.value})});
    if (!data.user || data.user.id !== identity.value) throw new Error("服务返回的身份与所选身份不一致，请重新选择后重试。");
    state.user = data.user;
    state.identityReady = true;
    confirmed = true;
    setScope(state.user);
    await loadOfferings();
  } catch (error) {
    state.identityReady = false;
    state.user = null;
    state.offerings = [];
    state.selected = null;
    state.summaryStatus = "idle";
    renderScopeSnapshot();
    identity.value = requestedIdentity;
    $("#scope-title").textContent = "身份未确认";
    $("#role-mark").textContent = "未确认";
    $("#role-task").textContent = "请重新选择模拟身份。";
    $("#scope-detail").textContent = "页面不保留上一个身份的查询结果。";
    $("#role-tools").replaceChildren();
    renderList();
    $("#detail").replaceChildren(empty("身份切换未完成", "重试身份确认，成功后才能继续查询。"));
    retryButton($("#detail"), "重试身份确认", switchIdentity);
    notice("身份切换未完成。请重新选择模拟身份；当前页面没有已确认的查询范围。 " + requestMessage(error));
  } finally {
    identity.disabled = false;
    term.disabled = !confirmed;
    $("#offering-list").setAttribute("aria-busy", "false");
    $("#detail").setAttribute("aria-busy", "false");
  }
}

async function init() {
  try {
    const data = await api("/api/bootstrap");
    const identityPlaceholder = el("option", "", "请选择模拟身份");
    identityPlaceholder.value = "";
    identityPlaceholder.disabled = true;
    $("#identity").replaceChildren(identityPlaceholder, ...data.users.map((user) => {
      const option = el("option", "", `${user.name} · ${roleNames[user.role]}`);
      option.value = user.id;
      return option;
    }));
    $("#term").replaceChildren(...data.terms.map((term) => {
      const option = el("option", "", term.name);
      option.value = term.id;
      return option;
    }));
    $("#identity").onchange = switchIdentity;
    $("#term").onchange = loadOfferings;
    $("#search").oninput = applyFilters;
    $("#teaching-filter").onchange = applyFilters;
    $("#sort").onchange = applyFilters;
    if (data.user && data.users.some((user) => user.id === data.user.id)) {
      $("#identity").value = data.user.id;
      state.user = data.user;
      state.identityReady = true;
      setScope(state.user);
      $("#identity").disabled = false;
      $("#term").disabled = false;
      await loadOfferings();
    } else {
      $("#identity").value = "";
      $("#identity").disabled = false;
      $("#term").disabled = true;
      state.identityReady = false;
      state.summaryStatus = "idle";
      renderScopeSnapshot();
      document.body.dataset.role = "";
      $("#role-mark").textContent = "未选身份";
      $("#role-task").textContent = "确认身份后，页面会显示该角色可查的开课与功能。";
      renderList();
    }
  } catch (error) {
    notice("无法连接本地服务：" + error.message + " 请检查终端服务是否运行，然后刷新页面。");
    $("#offering-list").replaceChildren(empty("服务不可用", "启动服务后刷新页面重试。"));
    $("#detail").replaceChildren(empty("暂不可查阅", "恢复本地服务后重新连接。"));
    retryButton($("#detail"), "重新连接", init);
    $("#identity").disabled = true;
    $("#term").disabled = true;
  }
}
$('#focus-mode').addEventListener('click', () => setFocusMode(!document.body.classList.contains('focus-mode')));
$('#reader-close').addEventListener('click', closeReader);
$('#reader').addEventListener('cancel', event => {event.preventDefault(); closeReader();});
init();


function updatePosition() {
  const items=visibleOfferings(), i=items.findIndex(o=>o.id===state.selected);
  const label=$('.position-label'); if(label) label.textContent=`筛选结果 ${i+1} / ${items.length}`;
  for(const button of document.querySelectorAll('[data-step]')) button.disabled=!items[i+Number(button.dataset.step)];
}

function setFocusMode(active) {
  document.body.classList.toggle('focus-mode',active);
  $('#focus-mode').textContent=active?'显示开课目录':'专注阅读';
  $('#focus-mode').setAttribute('aria-expanded',String(!active));
}

function syncRoleTools() {
  for(const button of document.querySelectorAll('[data-role-action]')) {
    const active=button.dataset.roleAction===state.tab;
    button.classList.toggle('active',active);
    if(active) button.setAttribute('aria-current','true'); else button.removeAttribute('aria-current');
  }
}

function renderResources(content, items, detail) {
  if(!items.length) { content.append(empty('暂无关联资料','当前开课尚未登记关联资料；这不表示课程从未建设资源。')); return; }
  let view=resourceViews.get(detail.id);
  if(!view) {view={query:'',status:'all'}; resourceViews.set(detail.id,view);}
  const tools=el('div','resource-tools');
  const field=el('div','field'); const label=el('label','','查找本课资料'); label.htmlFor='resource-search';
  const search=el('input'); search.type='search'; search.id='resource-search'; search.placeholder='资料名称、说明或来源'; search.value=view.query;
  field.append(label,search);
  const statusField=el('div','field'); const statusLabel=el('label','','访问状态'); statusLabel.htmlFor='resource-status';
  const status=el('select'); status.id='resource-status';
  for(const [value,text] of [['all','全部状态'],['available','可访问'],['broken','入口失效'],['no_entry','暂无入口'],['forbidden','权限不足']]) {
    const option=el('option','',text); option.value=value; status.append(option);
  }
  status.value=view.status; statusField.append(statusLabel,status); tools.append(field,statusField);
  const line=el('div','resource-result-line'); const count=el('span'); count.setAttribute('role','status');
  const toggle=el('button','text-button','收起全部'); toggle.type='button';
  line.append(count,toggle); const groups=el('div','resource-groups');
  function render() {
    view.query=search.value; view.status=status.value;
    const query=view.query.trim().toLocaleLowerCase();
    const filtered=items.filter(r=>(view.status==='all'||r.status===view.status)&&[r.name,r.description,r.source||''].join(' ').toLocaleLowerCase().includes(query));
    count.textContent=`显示 ${filtered.length} / ${items.length} 份资料`; groups.replaceChildren();
    toggle.hidden=!filtered.length; toggle.textContent='收起全部';
    if(!filtered.length) {
      groups.append(empty('没有匹配的资料','更换关键词或访问状态，继续查找本课资料。'));
      retryButton(groups,'清除资料筛选',()=>{search.value='';status.value='all';render();search.focus();}); return;
    }
    for(const scope of ['课程共用','本次开课']) {
      const resources=filtered.filter(r=>r.scope===scope); if(!resources.length) continue;
      const group=el('details','resource-group'); group.open=true;
      const summary=el('summary'); summary.append(el('strong','',scope),el('span','',`${resources.length} 份`));
      const hint=el('p','group-hint',scope==='课程共用'?'同一课程的开课共用资料':`${detail.class_name} · ${detail.id} 的专属资料`);
      group.append(summary,hint);
      group.addEventListener('toggle',()=>{const all=[...groups.querySelectorAll('details')];toggle.textContent=all.some(g=>g.open)?'收起全部':'展开全部';});
      for(const resource of resources) {
        const card=el('article','resource'); card.dataset.resource=resource.id;
        const icon=roleActionIcon('resources'); icon.classList.add('document-icon');
        const text=el('div','resource-copy'); const title=el('div','resource-title');
        const name=el('button','resource-name',resource.name); name.type='button';
        name.setAttribute('aria-label',`查看资料详情：${resource.name}`);
        name.addEventListener('click',()=>openReader(resource,detail,filtered,name));
        title.append(name,el('span','status '+resource.status,resource.status_label));
        text.append(title,el('p','',resource.description),el('p','resource-source','来源：'+(resource.source||'未提供')));
        const foot=el('div','resource-foot'); foot.append(el('small','',`${resource.id} · ${resource.scope}`));
        if(resource.url) foot.append(link('打开资料',resource.url)); else foot.append(el('small','',resource.status_label));
        text.append(foot); card.append(icon,text); group.append(card);
      }
      groups.append(group);
    }
  }
  toggle.addEventListener('click',()=>{const all=[...groups.querySelectorAll('details')],open=!all.some(g=>g.open);all.forEach(g=>g.open=open);toggle.textContent=open?'收起全部':'展开全部';});
  search.addEventListener('input',render); status.addEventListener('change',render);
  content.append(tools,line,groups); render();
}

function closeReader() {
  if(previewController) {previewController.abort();previewController=null;}
  const dialog=$('#reader');
  if(dialog?.open) {dialog.close();$('#reader-body').replaceChildren();if(previewTrigger?.isConnected) previewTrigger.focus();}
  previewTrigger=null;
}

async function openReader(resource,detail,items,trigger) {
  if(previewController) previewController.abort();
  previewController=new AbortController(); const controller=previewController;
  if(trigger) previewTrigger=trigger;
  const dialog=$('#reader'),body=$('#reader-body');
  $('#reader-title').textContent=resource.name;
  $('#reader-context').textContent=`${detail.course.name} / ${detail.class_name} / ${detail.id}`;
  const meta=el('div','reader-meta'); meta.append(el('span','status '+resource.status,resource.status_label),el('span','',resource.scope),el('p','','来源：'+(resource.source||'未提供')),el('p','',resource.description));
  body.replaceChildren(meta);
  const viewer=el('div','reader-content'); viewer.setAttribute('aria-live','polite'); body.append(viewer);
  const actions=$('#reader-actions'); actions.replaceChildren(); const position=items.findIndex(r=>r.id===resource.id);
  for(const [offset,label] of [[-1,'上一份'],[1,'下一份']]) {
    const button=el('button','quiet-button',label); button.type='button';button.disabled=!items[position+offset];
    button.addEventListener('click',()=>openReader(items[position+offset],detail,items)); actions.append(button);
  }
  actions.append(el('span','',`${position+1} / ${items.length}`));
  if(resource.url) actions.append(link('新窗口打开',resource.url));
  if(!dialog.open) dialog.showModal(); $('#reader-close').focus();
  if(!resource.url) {
    const help={forbidden:'当前身份没有资料访问权限；不会加载资料正文。',no_entry:'这份资料尚未登记可用入口。',broken:'登记入口不可用，请联系资料负责人核对。'};
    viewer.append(empty(resource.status_label,help[resource.status]||'当前资料暂不可读取。')); return;
  }
  viewer.textContent='正在读取资料…'; viewer.setAttribute('aria-busy','true');
  try {
    const response=await fetch(resource.url,{credentials:'same-origin',signal:controller.signal});
    if(!response.ok) throw new Error('资料暂无法读取，请重试或在新窗口中查看。');
    const type=response.headers.get('content-type')||'';
    if(!type.startsWith('text/plain')) {viewer.replaceChildren(empty('请在新窗口查阅','该资料格式不支持当前文本阅读面板。'));return;}
    const text=await response.text(); if(controller!==previewController) return;
    viewer.replaceChildren(el('pre','document-text',text));
  } catch(error) {
    if(error.name==='AbortError'||controller!==previewController) return;
    viewer.replaceChildren(empty('读取未完成',requestMessage(error)));
    retryButton(viewer,'重试读取',()=>openReader(resource,detail,items));
  } finally {if(controller===previewController) viewer.setAttribute('aria-busy','false');}
}
