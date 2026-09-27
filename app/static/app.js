"use strict";

// 所有动态文本通过textContent写入；服务端负责授权，界面只呈现查询结果。
const $ = (selector) => document.querySelector(selector);
const state = {user: null, offerings: [], selected: null, tab: "resources", epoch: 0, controller: null};
const roleNames = {teacher: "教师", director: "主任", supervisor: "督导"};

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
  if (state.controller) state.controller.abort();
  state.controller = new AbortController();
  state.epoch += 1;
  return {epoch: state.epoch, signal: state.controller.signal};
}

function renderList() {
  const list = $("#offering-list");
  list.replaceChildren();
  $("#offering-count").textContent = state.offerings.length;
  if (!state.offerings.length) {
    list.append(empty("暂无开课", "当前学期与身份范围内没有开课，请选择其他学期或模拟身份。"));
    return;
  }
  for (const offering of state.offerings) {
    const button = el("button", "offering" + (offering.id === state.selected ? " selected" : ""));
    button.type = "button";
    button.dataset.offering = offering.id;
    button.setAttribute("aria-pressed", String(offering.id === state.selected));
    const top = el("div", "offering-top");
    top.append(el("span", "course-code", offering.course.code + " · " + offering.id), el("span", "offering-arrow", "↗"));
    const bottom = el("div", "offering-bottom");
    bottom.append(el("span", "pill", offering.class_name), el("span", "", offering.teacher_ids.length > 1 ? "联合授课" : "独立开课"));
    button.append(top, el("h3", "", offering.course.name), el("p", "", offering.teachers.join(" / ")), bottom);
    button.addEventListener("click", () => selectOffering(offering));
    list.append(button);
  }
}

async function loadOfferings() {
  const query = beginQuery();
  state.selected = null;
  state.offerings = [];
  notice();
  $("#offering-count").textContent = "…";
  $("#offering-list").replaceChildren(empty("正在查询", "正在加载当前授权范围内的开课…"));
  $("#detail").replaceChildren(empty("选择一条开课", "课程、资源与督导记录会随选择同步更新。"));
  try {
    const data = await api("/api/offerings?term_id=" + encodeURIComponent($("#term").value), {signal: query.signal});
    if (query.epoch !== state.epoch) return;
    state.offerings = data.items;
    renderList();
    if (state.offerings.length) await selectOffering(state.offerings[0]);
  } catch (error) {
    if (error.name === "AbortError" || query.epoch !== state.epoch) return;
    renderList();
    notice(error.message);
    const retry = el("button", "retry", "重新查询");
    retry.addEventListener("click", loadOfferings);
    $("#offering-list").append(retry);
  }
}

async function selectOffering(offering) {
  const query = beginQuery();
  state.selected = offering.id;
  renderList();
  notice();
  $("#detail").replaceChildren(empty("正在加载开课", "正在核对课程与开课关系…"));
  try {
    const detail = await api(`/api/offerings/${offering.id}?course_id=${offering.course_id}`, {signal: query.signal});
    if (query.epoch !== state.epoch) return;
    renderDetail(detail);
    await loadTab(detail, query);
  } catch (error) {
    if (error.name === "AbortError" || query.epoch !== state.epoch) return;
    $("#detail").replaceChildren(empty("开课暂不可用", error.message));
  }
}

function renderDetail(detail) {
  const root = $("#detail");
  root.replaceChildren();
  const head = el("div", "detail-head");
  head.append(el("p", "eyebrow", `${detail.course.code} / ${detail.id}`), el("h2", "", detail.course.name), el("p", "", detail.term));
  const meta = el("div", "detail-meta");
  meta.append(el("span", "", detail.course.department), el("span", "", `${detail.course.credits} 学分`), el("span", "", detail.class_name));
  head.append(meta);
  const body = el("div", "detail-body");
  body.append(el("h3", "section-title", "课程简介"), el("p", "description", detail.course.description || "课程简介未提供。"), el("h3", "section-title", "本次开课安排"));
  const facts = el("dl", "facts");
  for (const [label, value] of [["任课教师", detail.teachers.join(" / ")], ["教学班", detail.class_name], ["教学时间", detail.schedule], ["教学地点", detail.room]]) {
    const fact = el("div");
    fact.append(el("dt", "", label), el("dd", "", value));
    facts.append(fact);
  }
  body.append(facts);
  const tabs = el("div", "tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "关联信息");
  for (const [id, text] of [["resources", "教学资源"], ["supervision", "督导记录"]]) {
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
      loadTab(detail, query);
    });
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const target = event.key === "Home" ? tabs.firstElementChild : event.key === "End" ? tabs.lastElementChild : (tab === tabs.firstElementChild ? tabs.lastElementChild : tabs.firstElementChild);
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
  content.setAttribute("aria-labelledby", "tab-" + state.tab);
  content.replaceChildren(empty("正在加载", "正在查询本次开课的关联信息…"));
  const tab = state.tab;
  try {
    const data = await api(`/api/offerings/${detail.id}/${tab}`, {signal: query.signal});
    if (query.epoch !== state.epoch) return;
    content.replaceChildren();
    if (tab === "resources") {
      if (!data.items.length) content.append(empty("暂无关联资料", "当前开课尚未登记关联资料；这不表示课程从未建设资源。"));
      for (const resource of data.items) {
        const card = el("article", "resource");
        card.dataset.resource = resource.id;
        const title = el("div", "resource-title");
        title.append(el("h4", "", resource.name), el("span", "status " + resource.status, resource.status_label));
        const foot = el("div", "resource-foot");
        foot.append(el("small", "", `${resource.id} · ${resource.scope}`));
        if (resource.url) foot.append(link("打开资料 ↗", resource.url));
        else foot.append(el("small", "", resource.status_label));
        card.append(title, el("p", "", resource.description), el("p", "", "来源：" + (resource.source || "未提供")), foot);
        content.append(card);
      }
    } else {
      content.append(el("div", "data-note", "数据状态：" + data.data_state + "。" + data.notice));
      if (!data.records.length) content.append(empty("未查询到督导记录", "请结合上方数据状态理解结果，不据此推断从未督导。"));
      for (const record of data.records) {
        const card = el("article", "resource");
        card.dataset.record = record.id;
        card.append(el("h4", "", `${record.date} · ${record.observer}`), el("p", "", record.summary), el("p", "", `开课 ${record.offering_id} · ${record.id} · 来源：${record.source}`), link("查阅事实来源 ↗", record.source_url, "source-link"));
        content.append(card);
      }
    }
  } catch (error) {
    if (error.name === "AbortError" || query.epoch !== state.epoch) return;
    content.replaceChildren(empty("暂无法查阅", error.message));
  }
}

function setScope(user) {
  $("#scope-title").textContent = user.role === "teacher" ? "仅显示本人承担的开课" : "仅显示计算机系授权开课";
  $("#scope-detail").textContent = "当前模拟角色：" + roleNames[user.role];
}

async function switchIdentity() {
  beginQuery();
  const identity = $("#identity");
  identity.disabled = true;
  $("#term").disabled = true;
  // 切换身份时立即清掉旧身份数据，失败后也不显示旧内容。
  state.offerings = [];
  state.selected = null;
  renderList();
  $("#detail").replaceChildren(empty("正在切换模拟身份", "重新核对可见范围…"));
  try {
    const data = await api("/api/demo-session", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({user_id: identity.value})});
    state.user = data.user;
    setScope(state.user);
    await loadOfferings();
  } catch (error) {
    notice(error.message);
    $("#detail").replaceChildren(empty("身份切换未完成", "请重新选择模拟身份后重试。"));
  } finally {
    identity.disabled = false;
    $("#term").disabled = false;
  }
}

async function init() {
  try {
    const data = await api("/api/bootstrap");
    $("#identity").replaceChildren(...data.users.map((user) => {
      const option = el("option", "", `${user.name} · ${roleNames[user.role]}`);
      option.value = user.id;
      return option;
    }));
    $("#term").replaceChildren(...data.terms.map((term) => {
      const option = el("option", "", term.name);
      option.value = term.id;
      return option;
    }));
    $("#identity").addEventListener("change", switchIdentity);
    $("#term").addEventListener("change", loadOfferings);
    $("#identity").value = data.user ? data.user.id : "teacher-a";
    await switchIdentity();
  } catch (error) {
    notice("无法连接本地服务：" + error.message + " 请检查终端服务是否运行，然后刷新页面。");
    $("#offering-list").replaceChildren(empty("服务不可用", "启动服务后刷新页面重试。"));
  }
}
init();
