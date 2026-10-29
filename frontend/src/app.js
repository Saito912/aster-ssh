import "./style.css";
import "./desktop.css";
import "./layout.css";
import "./theme.css";
import {
  $,
  $$,
  api,
  esc,
  icon,
  decorate,
  notice,
  fail,
  message,
  dialog,
  closeDialog,
  heading,
  confirmAction,
  busy,
  bytes,
  initModalKeys,
} from "./ui.js";
import { Terminals } from "./terminals.js";
import { Files } from "./files.js";
import { storageView } from "./storage.js";

const state = {
  hosts: [],
  preferences: {
    theme: "light",
    appearanceVersion: 2,
    fontSize: 14,
    scrollback: 5000,
    monitor: true,
    copyOnSelect: false,
    downloadDirectory: "",
    sidebarCollapsed: false,
  },
  snippets: [],
  sessions: new Map(),
  tabs: [],
  active: null,
  split: null,
  focused: null,
  connecting: new Set(),
  secrets: new Map(),
  collapsed: new Set(),
  filter: "all",
  panel: "files",
  version: "1.0.3",
  monitoring: false,
  dataDirectory: "",
};
const active = () => state.sessions.get(state.active);
const terms = new Terminals(
  () => state.preferences,
  (id) => (state.focused = id),
);
const files = new Files(
  active,
  setPanel,
  (value) => (state.preferences.downloadDirectory = value),
);
const statusLabel = (s) => (s?.connected ? "已连接" : s ? "已断开" : "未连接");

function renderHosts() {
  const query = $("#host-search").value.trim().toLowerCase(),
    hosts = state.hosts.filter(
      (h) =>
        (state.filter !== "favorites" || h.favorite) &&
        `${h.name} ${h.address} ${h.group}`.toLowerCase().includes(query),
    );
  $("#host-count").textContent = state.hosts.length;
  $("#host-groups").innerHTML =
    [...new Set(hosts.map((h) => h.group))]
      .map(
        (group) =>
          `<section class="host-group"><button class="group-title" data-group="${esc(group)}" aria-expanded="${!state.collapsed.has(group)}">${icon(state.collapsed.has(group) ? "chevron-right" : "chevron-down")}<span>${esc(group)}</span><span class="group-count">${hosts.filter((h) => h.group === group).length}</span></button><div ${state.collapsed.has(group) ? "hidden" : ""}>${hosts
            .filter((h) => h.group === group)
            .map(
              (h) =>
                `<div class="host-row"><button class="host-card ${active()?.host.id === h.id ? "active" : ""}" data-host="${esc(h.id)}" title="${esc(h.user)}@${esc(h.address)}:${h.port}"><span class="host-symbol">${icon("server")}<i class="${[...state.sessions.values()].some((s) => s.host.id === h.id && s.connected) ? "connected" : ""}"></i></span><span class="host-detail"><strong>${esc(h.name)}</strong><span>${esc(h.address)}</span></span>${state.connecting.has(h.id) ? '<span class="connecting-spinner"></span>' : h.favorite ? '<span class="host-favorite">★</span>' : ""}</button><button class="host-edit icon-button" data-edit-host="${esc(h.id)}" title="编辑连接" aria-label="编辑 ${esc(h.name)}">${icon("edit")}</button></div>`,
            )
            .join("")}</div></section>`,
      )
      .join("") ||
    `<div class="sidebar-empty">${icon("server")}<p>${state.hosts.length ? "没有匹配的连接" : "从第一台服务器开始"}</p><span>${state.hosts.length ? "试试其他名称或 IP" : "点击下方按钮添加 SSH 连接"}</span></div>`;
}
function renderTabs() {
  $("#tabs").innerHTML = state.tabs
    .map((id) => {
      const s = state.sessions.get(id);
      return `<div class="session-tab ${id === state.active ? "active" : ""} ${s.connected ? "" : "tab-disconnected"}" role="tab" aria-selected="${id === state.active}" tabindex="${id === state.active ? 0 : -1}" data-tab="${id}"><i></i><span>${esc(s.host.name)}</span><button data-close-tab="${id}" title="关闭会话" aria-label="关闭 ${esc(s.host.name)}">${icon("x")}</button></div>`;
    })
    .join("");
  $("#connection-count").textContent =
    `${[...state.sessions.values()].filter((s) => s.connected).length} 个活跃会话`;
}
function renderToolbar() {
  const s = active();
  $("#toolbar-name").textContent = s?.host.name || "连接工作台";
  $("#session-address").textContent = s
    ? `${s.host.user}@${s.host.address}:${s.host.port}`
    : "准备好连接下一台服务器";
  $("#environment-label").textContent = s?.host.group || "";
  $("#environment-label").hidden = !s;
  $("#latency").textContent = statusLabel(s);
  $(".connection-health").classList.toggle("offline", !s?.connected);
  $(".connection-health").title = s ? `连接建立耗时 ${s.latency} ms` : "";
  for (const action of ["split", "reconnect", "log", "tunnels"]) {
    $(`[data-action="${action}"]`).disabled =
      action === "reconnect" ? !s : !s?.connected;
  }
  $('[data-action="log"]').classList.toggle("selected", !!s?.logPath);
  $('[data-action="split"]').classList.toggle("selected", !!state.split);
  $('[data-action="split"]').setAttribute(
    "aria-pressed",
    String(!!state.split),
  );
  $("#empty-workspace").hidden = !!s;
  $("#terminal-area").classList.toggle("has-session", !!s);
  document.title = s ? `${s.host.name} · Aster SSH` : "Aster SSH";
  window.runtime?.WindowSetTitle(document.title);
}
function selectSession(id) {
  if (!state.sessions.has(id)) return;
  state.active = id;
  state.focused = id;
  terms.show(id, state.split);
  renderTabs();
  renderHosts();
  renderToolbar();
  files.show();
  renderMonitor();
  if (innerWidth <= 720) setSidebarCollapsed(true, false);
  requestAnimationFrame(() => terms.focus(id));
  pollStats();
}
async function closeSession(id) {
  const s = state.sessions.get(id);
  if (!s) return;
  if (s.connected) {
    const transfers = [...files.transfers.values()].filter(
      (t) => t.sessionId === id && ["queued", "running"].includes(t.status),
    );
    if (
      transfers.length &&
      !(await confirmAction(
        "关闭会话",
        `还有 ${transfers.length} 个传输任务，关闭连接将取消这些任务。`,
        { accept: "关闭连接", danger: true },
      ))
    )
      return;
    await api.Disconnect(id);
  }
  terms.remove(id);
  state.sessions.delete(id);
  const index = state.tabs.indexOf(id);
  state.tabs = state.tabs.filter((x) => x !== id);
  if (state.split === id) state.split = null;
  if (state.active === id) {
    state.active = state.tabs[Math.min(index, state.tabs.length - 1)] || null;
    if (!state.active && state.split) {
      state.active = state.split;
      state.tabs.push(state.split);
      state.split = null;
    }
  }
  if (
    ![...state.sessions.values()].some(
      (x) => x.host.id === s.host.id && x.connected,
    )
  )
    state.secrets.delete(s.host.id);
  if (state.active) selectSession(state.active);
  else {
    terms.show(null, null);
    renderTabs();
    renderHosts();
    renderToolbar();
    files.empty();
    renderMonitor();
  }
}

function login(h, { error = "", split = false, replace = null } = {}) {
  dialog(
    `${heading(`连接 ${h.name}`)}<p class="modal-description">${esc(h.user)}@${esc(h.address)}:${h.port}${error ? `<br><span class="danger-text">${esc(error)}</span>` : ""}</p><form id="login-form" class="modal-form"><label>${h.auth === "key" ? "私钥口令（无口令可留空）" : "登录密码"}<input name="secret" type="password" autocomplete="off" ${h.auth === "password" && !h.hasSecret ? "required" : ""} placeholder="${h.hasSecret ? "已保存凭据，留空使用" : ""}"></label><label class="checkbox-label"><input type="checkbox" name="remember">在此 Windows 账户下加密保存凭据</label><div class="modal-actions"><button class="button-secondary" type="button" data-action="close-modal">取消</button><button class="button-primary" type="submit">连接服务器</button></div></form>`,
  );
  $("#login-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      credentials =
        h.auth === "key"
          ? { passphrase: f.get("secret"), password: "" }
          : { password: f.get("secret"), passphrase: "" },
      remember = f.get("remember") === "on";
    closeDialog();
    connect(h, { credentials, remember, split, replace, force: true });
  };
}
function hostKeyDialog(challenge, callback) {
  return new Promise((resolve) => {
    dialog(
      `${heading(challenge.changed ? "服务器指纹发生变化" : "确认服务器身份")}<p class="modal-description">${challenge.changed ? "已拒绝连接。请通过可信渠道核对服务器是否重装或更换密钥，并在数据目录中检查 known_hosts。" : "首次连接此服务器。请通过可信渠道核对下面的 SHA-256 指纹。"}</p><div class="fingerprint-card"><span>主机</span><strong>${esc(challenge.address)}</strong><span>算法</span><strong>${esc(challenge.keyType)}</strong><span>服务器指纹</span><code>${esc(challenge.fingerprint)}</code>${challenge.changed ? `<span>已保存指纹</span><code>${esc(challenge.knownFingerprint)}</code>` : ""}</div><div class="modal-actions"><button class="button-secondary" id="trust-cancel">${challenge.changed ? "关闭" : "取消"}</button>${challenge.changed ? "" : '<button class="button-primary" id="trust-confirm">信任并保存指纹</button>'}</div>`,
      { onCancel: () => resolve(false) },
    );
    $("#trust-cancel").onclick = () => {
      closeDialog(false);
      resolve(false);
    };
    $("#trust-confirm")?.addEventListener("click", () => {
      closeDialog(false);
      resolve(true);
    });
  });
}
async function openHost(
  id,
  { split = false, replace = null, force = false } = {},
) {
  const h = state.hosts.find((h) => h.id === id);
  if (!h) {
    notice("连接配置不存在，请重新添加", true);
    return;
  }
  const existing = state.tabs.find(
    (id) =>
      state.sessions.get(id)?.host.id === h.id &&
      state.sessions.get(id)?.connected,
  );
  if (existing && !split && !force && !replace) {
    selectSession(existing);
    return;
  }
  const memory = state.secrets.get(id);
  if (h.auth === "password" && !h.hasSecret && !memory?.password)
    return login(h, { split, replace });
  return connect(h, { credentials: memory || {}, split, replace, force });
}
async function connect(
  h,
  { credentials = {}, remember = false, split = false, replace = null } = {},
) {
  if (state.connecting.has(h.id)) {
    notice("正在连接此服务器，请稍候");
    return;
  }
  state.connecting.add(h.id);
  renderHosts();
  $("#app-state").textContent = "正在连接…";
  let result;
  try {
    let request = { hostId: h.id, credentials, approvedFingerprint: "" };
    result = await api.Connect(request);
    if (result.challenge) {
      if (!(await hostKeyDialog(result.challenge))) return;
      request.approvedFingerprint = result.challenge.fingerprint;
      result = await api.Connect(request);
      if (result.challenge) throw new Error("服务器指纹再次变化，连接已取消");
    }
    if (!result.id) throw new Error("未能建立 SSH 会话");
    const session = {
      id: result.id,
      host: result.host,
      connected: true,
      latency: result.latencyMs,
      directory: null,
      stats: null,
      cpu: [],
      network: [],
      sampleCount: 0,
    };
    state.sessions.set(session.id, session);
    terms.add(session);
    if (split) {
      if (state.split) await closeSession(state.split);
      state.split = session.id;
      terms.show(state.active, state.split);
      renderTabs();
      renderToolbar();
    } else {
      state.tabs.push(session.id);
      selectSession(session.id);
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const dimensions = terms.dimensions(session.id);
    await api.StartShell(session.id, dimensions.cols, dimensions.rows);
    if (credentials.password || credentials.passphrase)
      state.secrets.set(h.id, credentials);
    if (remember) {
      const saved = await api.SaveHost({
        host: h,
        credentials,
        remember: true,
        keepSecret: true,
      });
      state.hosts = state.hosts.map((x) => (x.id === saved.id ? saved : x));
    }
    if (replace && replace !== session.id) {
      await closeSession(replace);
      selectSession(session.id);
    }
    renderHosts();
    files.show();
    notice(`已连接 ${h.name}`);
    pollStats();
  } catch (error) {
    if (result?.id) {
      await api.Disconnect(result.id).catch(() => {});
      if (state.sessions.has(result.id)) await closeSession(result.id);
    }
    fail(error);
    login(h, { error: message(error), split, replace });
  } finally {
    state.connecting.delete(h.id);
    renderHosts();
    $("#app-state").textContent = "本地客户端";
  }
}

function editHost(id) {
  const existing = state.hosts.find((h) => h.id === id),
    h = existing || {
      id: "",
      name: "",
      address: "",
      port: 22,
      user: "root",
      group: "开发环境",
      auth: "password",
      keyPath: "",
      favorite: false,
    };
  dialog(
    `${heading(existing ? "编辑连接" : "新建连接")}<p class="modal-description">${existing ? "更新服务器信息，已有会话不会受影响。" : "连接你的服务器，开始专注工作。"}</p><form id="host-form" class="modal-form"><label>连接名称<input name="name" value="${esc(h.name)}" placeholder="例如：生产服务器" maxlength="80" required></label><div class="form-row"><label style="flex:3">主机地址<input name="address" value="${esc(h.address)}" placeholder="IP 地址或域名" required></label><label style="flex:1">端口<input name="port" type="number" min="1" max="65535" value="${h.port}" required></label></div><div class="form-row"><label>用户名<input name="user" value="${esc(h.user)}" required></label><label>分组<input name="group" value="${esc(h.group)}" list="group-list"><datalist id="group-list">${[...new Set(["生产环境", "开发环境", "个人服务器", ...state.hosts.map((h) => h.group)])].map((g) => `<option value="${esc(g)}"></option>`).join("")}</datalist></label></div><div class="form-row"><label>认证方式<select name="auth"><option value="password" ${h.auth === "password" ? "selected" : ""}>密码</option><option value="key" ${h.auth === "key" ? "selected" : ""}>私钥（OpenSSH / PEM）</option></select></label><label>登录密码 / 私钥口令<input name="secret" type="password" autocomplete="new-password" placeholder="${h.hasSecret ? "已保存，留空保留" : "可在连接时输入"}"></label></div><label id="key-row" ${h.auth === "key" ? "" : "hidden"}>私钥路径<div class="input-with-button"><input name="keyPath" value="${esc(h.keyPath)}" placeholder="选择本机的私钥文件"><button type="button" id="choose-key" class="button-secondary">选择</button></div></label><div class="form-options"><label class="checkbox-label"><input type="checkbox" name="favorite" ${h.favorite ? "checked" : ""}>加入收藏</label><label class="checkbox-label"><input type="checkbox" name="remember">加密保存新凭据</label></div>${h.hasSecret ? '<label class="checkbox-label"><input type="checkbox" name="clearSecret">清除已保存的密码 / 私钥口令</label>' : ""}<div class="form-note">${icon("shield")}凭据使用 Windows DPAPI 保护，不会出现在连接导出文件中。</div><div class="modal-actions">${existing ? '<button type="button" class="button-secondary danger-text" id="delete-host">删除连接</button>' : ""}<button type="button" class="button-secondary" id="save-host-only">保存</button><button type="submit" class="button-primary">保存并连接</button></div></form>`,
  );
  $('[name="auth"]', $("#host-form")).onchange = (e) =>
    ($("#key-row").hidden = e.target.value !== "key");
  $("#choose-key").onclick = () =>
    busy($("#choose-key"), async () => {
      const p = await api.ChoosePrivateKey();
      if (p) $('[name="keyPath"]').value = p;
    });
  const save = async (open, button) =>
    busy(button, async () => {
      const form = $("#host-form");
      if (!form.reportValidity()) return;
      const f = new FormData(form),
        auth = f.get("auth"),
        secret = f.get("secret"),
        credentials =
          auth === "key"
            ? { password: "", passphrase: secret }
            : { password: secret, passphrase: "" };
      const value = {
        ...h,
        name: f.get("name"),
        address: f.get("address"),
        port: Number(f.get("port")),
        user: f.get("user"),
        group: f.get("group"),
        auth,
        keyPath: f.get("keyPath"),
        favorite: f.get("favorite") === "on",
      };
      const saved = await api.SaveHost({
        host: value,
        credentials,
        remember: f.get("remember") === "on",
        keepSecret: !!existing && f.get("clearSecret") !== "on",
      });
      state.hosts = state.hosts.filter((x) => x.id !== saved.id).concat(saved);
      closeDialog();
      renderHosts();
      if (open) {
        if (auth === "password" && !credentials.password && !saved.hasSecret)
          login(saved);
        else connect(saved, { credentials });
      } else notice("连接配置已保存");
    });
  $("#host-form").onsubmit = (e) => {
    e.preventDefault();
    save(true, e.submitter);
  };
  $("#save-host-only").onclick = (e) => save(false, e.currentTarget);
  $("#delete-host")?.addEventListener("click", async () => {
    if (
      await confirmAction(
        "删除连接配置",
        `删除 ${h.name} 的连接配置和已保存凭据。当前已连接会话会保留。`,
        { accept: "删除配置", danger: true },
      )
    ) {
      try {
        await api.DeleteHost(h.id);
        state.hosts = state.hosts.filter((x) => x.id !== h.id);
        state.secrets.delete(h.id);
        renderHosts();
        notice("连接配置已删除");
      } catch (error) {
        fail(error);
      }
    }
  });
}

function setPanel(panel) {
  state.panel = panel;
  $(".files-panel").classList.remove("collapsed");
  $$("[data-panel]").forEach((b) =>
    b.classList.toggle("active", b.dataset.panel === panel),
  );
  ["files", "transfers", "snippets"].forEach(
    (key) => ($(`#${key}-view`).hidden = key !== panel),
  );
  if (panel === "transfers") files.renderTransfers();
  if (panel === "snippets") renderSnippets();
  $$(".rail-top .rail-button").forEach((b) =>
    b.classList.toggle(
      "active",
      b.dataset.action === (panel === "files" ? "sessions" : panel),
    ),
  );
  terms.scheduleFit();
}
function renderSnippets() {
  $("#snippets-view").innerHTML =
    `<div class="snippets-heading"><span>点击填入终端，按 Enter 执行</span><button class="text-button" data-action="edit-snippets">${icon("edit")}管理命令</button></div><div class="snippet-grid">${state.snippets.map((s, i) => `<button class="snippet-card" data-snippet="${i}"><strong>${esc(s.name)}${icon("terminal")}</strong><code>${esc(s.command)}</code></button>`).join("")}</div>`;
}
function editSnippets() {
  dialog(
    `${heading("管理快捷命令")}<p class="modal-description">每条命令占两行：第一行名称，第二行命令；条目之间空一行。</p><form id="snippets-form" class="modal-form"><textarea id="snippets-text" aria-label="快捷命令">${esc(state.snippets.map((s) => s.name + "\n" + s.command).join("\n\n"))}</textarea><div class="modal-actions"><button class="button-secondary" type="button" data-action="close-modal">取消</button><button class="button-primary" type="submit">保存命令</button></div></form>`,
  );
  $("#snippets-form").onsubmit = (e) => {
    e.preventDefault();
    busy(e.submitter, async () => {
      const text = $("#snippets-text").value.trim(),
        items = text
          ? text.split(/\n\s*\n/).map((block, i) => {
              const lines = block.split("\n");
              return {
                id: `snippet-${i}`,
                name: lines.shift().trim(),
                command: lines.join("\n").trim(),
              };
            })
          : [];
      await api.SaveSnippets(items);
      state.snippets = items;
      closeDialog();
      renderSnippets();
      notice("快捷命令已保存");
    });
  };
}
function applyTheme() {
  const theme = state.preferences.theme;
  document.body.classList.toggle("dark", theme === "dark");
  document.body.classList.toggle("light", theme !== "dark");
  $('[data-action="theme"]').innerHTML = icon(
    theme === "dark" ? "moon" : "sun",
  );
  theme === "dark"
    ? window.runtime?.WindowSetDarkTheme()
    : window.runtime?.WindowSetLightTheme();
}
async function savePreferences(change) {
  state.preferences = { ...state.preferences, ...change };
  applyTheme();
  terms.update();
  return persistPreferences();
}
let preferenceWrites = Promise.resolve();
function persistPreferences() {
  if (!window.go?.main?.App) return Promise.resolve();
  const snapshot = { ...state.preferences };
  preferenceWrites = preferenceWrites
    .catch(() => {})
    .then(() => api.SavePreferences(snapshot));
  return preferenceWrites.catch(fail);
}
function setSidebarCollapsed(collapsed, persist = true) {
  collapsed = Boolean(collapsed);
  state.preferences.sidebarCollapsed = collapsed;
  document.body.classList.toggle("connections-collapsed", collapsed);
  const sidebar = $(".connections-sidebar");
  const moveFocus = collapsed && sidebar.contains(document.activeElement);
  sidebar.hidden = collapsed;
  sidebar.classList.toggle("mobile-visible", !collapsed && innerWidth <= 720);
  const toggle = $("#connections-toggle");
  toggle.title = `${collapsed ? "展开" : "收起"}连接栏 (Ctrl+Shift+B)`;
  toggle.setAttribute("aria-label", `${collapsed ? "展开" : "收起"}连接栏`);
  toggle.setAttribute("aria-expanded", String(!collapsed));
  if (moveFocus) toggle.focus();
  $('[data-action="sessions"]').setAttribute(
    "aria-expanded",
    String(!collapsed),
  );
  terms.scheduleFit();
  if (persist) persistPreferences();
}
function setMonitor(show, persist = true) {
  state.preferences.monitor = show;
  document.body.classList.toggle("monitor-hidden", !show);
  $$('[data-action="monitor"]').forEach((b) => {
    b.classList.toggle("selected", show);
    b.setAttribute("aria-pressed", String(show));
  });
  if (persist) persistPreferences();
  terms.scheduleFit();
  if (show) pollStats();
}
function settings() {
  dialog(
    `${heading("让工作台更合你意")}<p class="modal-description">Aster SSH ${state.version} · Go / Wails / xterm.js</p><div class="setting-row"><div><strong>界面主题</strong><p>面板与终端统一切换配色</p></div><select id="pref-theme" aria-label="界面主题"><option value="light" ${state.preferences.theme === "light" ? "selected" : ""}>柔和浅色</option><option value="dark" ${state.preferences.theme === "dark" ? "selected" : ""}>柔和深色</option></select></div><div class="setting-row"><div><strong>终端字号</strong><p>Cascadia Code / Consolas</p></div><select id="pref-font" aria-label="终端字号">${[10, 11, 12, 13, 14, 15, 16, 18, 20, 24].map((n) => `<option value="${n}" ${state.preferences.fontSize === n ? "selected" : ""}>${n} px</option>`).join("")}</select></div><div class="setting-row"><div><strong>终端历史行数</strong><p>限制每个会话的回滚缓存</p></div><select id="pref-scrollback" aria-label="终端历史行数">${[1000, 3000, 5000, 10000, 20000].map((n) => `<option value="${n}" ${state.preferences.scrollback === n ? "selected" : ""}>${n}</option>`).join("")}</select></div><div class="setting-row"><div><strong>选中即复制</strong><p>同时保留 Ctrl+Shift+C / V</p></div><button id="pref-copy" class="toggle ${state.preferences.copyOnSelect ? "on" : ""}" role="switch" aria-checked="${state.preferences.copyOnSelect}" aria-label="选中即复制"></button></div><div class="setting-row"><div><strong>连接配置</strong><p>导出仅包含地址、用户名和私钥路径</p></div><div class="setting-buttons"><button id="import-config" class="button-secondary">导入</button><button id="export-config" class="button-secondary">导出</button></div></div><div class="setting-row"><div><strong>本机数据目录</strong><p class="data-path">${esc(state.dataDirectory)}</p></div><button id="open-data" class="button-secondary">打开</button></div><div class="modal-actions"><button class="button-primary" data-action="close-modal">完成</button></div>`,
  );
  $("#pref-theme").onchange = (e) => savePreferences({ theme: e.target.value });
  $("#pref-font").onchange = (e) =>
    savePreferences({ fontSize: Number(e.target.value) });
  $("#pref-scrollback").onchange = (e) =>
    savePreferences({ scrollback: Number(e.target.value) });
  $("#pref-copy").onclick = (e) => {
    const value = !state.preferences.copyOnSelect;
    e.currentTarget.classList.toggle("on", value);
    e.currentTarget.setAttribute("aria-checked", String(value));
    savePreferences({ copyOnSelect: value });
  };
  $("#export-config").onclick = (e) =>
    busy(e.currentTarget, async () => {
      if (await api.ExportConnections()) notice("连接配置已导出（不含密码）");
    });
  $("#import-config").onclick = (e) =>
    busy(e.currentTarget, async () => {
      const n = await api.ImportConnections();
      if (n) {
        state.hosts = (await api.GetConfig()).hosts;
        renderHosts();
        notice(`已导入 ${n} 个连接`);
      }
    });
  $("#open-data").onclick = () => api.OpenDataDirectory().catch(fail);
}
function palette() {
  dialog(
    `<div class="palette-input"><span>${icon("search")}</span><input id="palette-search" placeholder="搜索连接，或输入操作…" aria-label="搜索连接或操作"><kbd>Esc</kbd></div><h2 id="modal-title" class="sr-only">快速查找</h2><div id="palette-results" class="palette-results"></div><div class="palette-footer"><span>↑ ↓ 选择 · Enter 打开</span><span>Aster SSH</span></div>`,
    { palette: true },
  );
  const render = () => {
    const q = $("#palette-search").value.toLowerCase(),
      items = [
        ...state.hosts.map((h) => ({
          title: h.name,
          sub: `${h.address} · ${h.group}`,
          icon: "server",
          attrs: `data-host="${h.id}"`,
        })),
        {
          title: "新建连接",
          sub: "添加 SSH 服务器",
          icon: "plus",
          attrs: 'data-action="new-host"',
        },
        {
          title: "偏好设置",
          sub: "主题、字体与配置导入导出",
          icon: "settings",
          attrs: 'data-action="settings"',
        },
      ].filter((x) => (x.title + " " + x.sub).toLowerCase().includes(q));
    $("#palette-results").innerHTML =
      items
        .map(
          (item) =>
            `<button class="palette-result" ${item.attrs}><span>${icon(item.icon)}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.sub)}</small></div>${icon("chevron-right")}</button>`,
        )
        .join("") || '<div class="empty-state">没有匹配的连接</div>';
  };
  render();
  $("#palette-search").oninput = render;
  $("#modal").addEventListener("keydown", (e) => {
    const items = $$(".palette-result");
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    if (e.key === "Enter" && i < 0) {
      e.preventDefault();
      items[0].click();
    } else if (["ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      items[
        (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
      ].focus();
    }
  });
}
function shortcuts() {
  dialog(
    `${heading("指尖之间，更快一步")}<p class="modal-description">终端直接连接远程 Shell，支持中文输入与全屏终端程序。</p>${[
      ["查找 / 打开连接", "Ctrl K"],
      ["搜索终端", "Ctrl F"],
      ["新建连接", "Ctrl Shift N"],
      ["复制选中内容", "Ctrl Shift C"],
      ["粘贴剪贴板", "Ctrl Shift V"],
      ["清屏（由远程 Shell 处理）", "Ctrl L"],
      ["远程命令历史", "↑ / ↓"],
      ["搜索连接", "/"],
      ["关闭弹窗", "Esc"],
    ]
      .map(
        ([label, key]) =>
          `<div class="shortcut-row"><span>${label}</span><kbd>${key}</kbd></div>`,
      )
      .join(
        "",
      )}<div class="modal-actions"><button class="button-primary" data-action="close-modal">知道了</button></div>`,
  );
}
async function tunnels() {
  const s = active();
  if (!s?.connected) return;
  const list = await api.GetTunnels();
  dialog(
    `${heading("本地端口转发")}<p class="modal-description">通过 ${esc(s.host.name)} 访问远端服务。监听仅绑定本机 127.0.0.1。</p><div class="tunnel-list">${list.map((t) => `<div class="tunnel-item"><div><strong>${esc(t.localAddress)}</strong><small>→ ${esc(t.destination)}</small></div><button class="text-button danger-text" data-stop-tunnel="${t.id}">停止</button></div>`).join("") || '<div class="tunnel-empty">当前没有端口转发</div>'}</div><form id="tunnel-form" class="modal-form"><div class="form-row"><label>本地端口<input type="number" name="local" min="0" max="65535" value="0" required></label><label>远端端口<input type="number" name="remote" min="1" max="65535" value="3306" required></label></div><label>目标主机（从 SSH 服务器访问）<input name="dest" value="127.0.0.1" required></label><div class="modal-actions"><button class="button-secondary" type="button" data-action="close-modal">关闭</button><button class="button-primary" type="submit">创建转发</button></div></form><p class="form-hint">本地端口填 0 自动分配；SSH 会话断开时自动停止。</p>`,
  );
  $$("[data-stop-tunnel]", $("#modal")).forEach(
    (b) =>
      (b.onclick = () =>
        busy(b, async () => {
          await api.StopTunnel(b.dataset.stopTunnel);
          notice("转发已停止");
          tunnels();
        })),
  );
  $("#tunnel-form").onsubmit = (e) => {
    e.preventDefault();
    busy(e.submitter, async () => {
      const f = new FormData(e.target),
        t = await api.StartTunnel(
          s.id,
          Number(f.get("local")),
          f.get("dest"),
          Number(f.get("remote")),
        );
      notice(`转发已就绪：${t.localAddress}`);
      tunnels();
    });
  };
}

function renderMonitor() {
  const s = active(),
    stats = s?.stats;
  $("#monitor-host").textContent = s?.host.name || "尚未连接";
  $("#monitor-os").textContent =
    stats?.os || s?.statsError || "连接 Linux 服务器后显示实时指标";
  $(".live-label").innerHTML =
    `<i></i>${s?.connected ? (s.statsError ? "不可用" : stats ? "实时" : "等待采样") : "未连接"}`;
  $(".server-specs").innerHTML =
    `<span>${icon("cpu")}${stats ? stats.cores + " vCPU" : "— vCPU"}</span><span>${icon("memory")}${stats ? bytes(stats.memoryTotal) : "— RAM"}</span>`;
  $("#cpu-value").textContent =
    stats && s.sampleCount > 1 ? stats.cpu.toFixed(1) : "—";
  $(".metric-card .metric-label>span:last-child").textContent = stats
    ? stats.cores + " 核"
    : "—";
  $(".metric-note").textContent = stats
    ? `采样 ${stats.sampleMs} ms`
    : "等待采样";
  $("#memory-value").textContent = stats ? stats.memoryPercent.toFixed(1) : "—";
  $$(".metric-card")[1].querySelector(
    ".metric-label>span:last-child",
  ).textContent = stats ? bytes(stats.memoryTotal) : "—";
  $$(".metric-note")[1].textContent = stats
    ? `${bytes(stats.memoryUsed)} / ${bytes(stats.memoryTotal)}`
    : "—";
  $(".memory-bar>span").style.width = `${stats?.memoryPercent || 0}%`;
  $(".memory-legend>span:last-child").textContent = stats
    ? `可用 ${bytes(stats.memoryTotal - stats.memoryUsed)}`
    : "等待采样";
  $("#network-down").innerHTML =
    stats && s.sampleCount > 1
      ? `${bytes(stats.receiveRate)}<small> /s</small>`
      : "—";
  $("#network-up").innerHTML =
    stats && s.sampleCount > 1
      ? `${bytes(stats.sendRate)}<small> /s</small>`
      : "—";
  const inventoryOpen = $("[data-storage-inventory]")?.open || false;
  const storage = storageView(stats, inventoryOpen);
  $("#disk-count").textContent = storage.count;
  $("#disk-list").innerHTML = storage.html;
  $(".monitor-footer strong").textContent = stats
    ? `${Math.floor(stats.uptime / 86400)} 天 ${Math.floor(stats.uptime / 3600) % 24} 小时`
    : "—";
  const cpuPath = plot(s?.cpu || [], 100, 52);
  $(".cpu-chart .line").setAttribute("d", cpuPath);
  $(".cpu-chart .area").setAttribute(
    "d",
    cpuPath ? `${cpuPath} L220,52 L0,52 Z` : "",
  );
  const net = s?.network || [],
    max = Math.max(1, ...net.flat());
  $(".network-chart .line").setAttribute(
    "d",
    plot(
      net.map((x) => x[0]),
      max,
      42,
    ),
  );
  $(".network-chart .secondary").setAttribute(
    "d",
    plot(
      net.map((x) => x[1]),
      max,
      42,
    ),
  );
}
function plot(values, max, height) {
  if (values.length < 2) return "";
  return values
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${((i * 220) / (values.length - 1)).toFixed(1)},${(height - 3 - (Math.min(max, v) / max) * (height - 6)).toFixed(1)}`,
    )
    .join(" ");
}
async function pollStats() {
  const s = active();
  if (
    !s?.connected ||
    !state.preferences.monitor ||
    state.monitoring ||
    document.hidden
  )
    return;
  state.monitoring = true;
  try {
    if (await window.runtime?.WindowIsMinimised()) return;
    const stats = await api.GetStats(s.id);
    s.stats = stats;
    s.statsError = null;
    s.sampleCount++;
    s.cpu.push(stats.cpu);
    s.cpu = s.cpu.slice(-21);
    s.network.push([stats.receiveRate, stats.sendRate]);
    s.network = s.network.slice(-21);
    if (active() === s) renderMonitor();
  } catch (error) {
    s.statsError = message(error);
    if (active() === s) renderMonitor();
  } finally {
    state.monitoring = false;
  }
}

async function action(name, button) {
  switch (name) {
    case "new-host":
      editHost();
      break;
    case "palette":
      palette();
      break;
    case "theme":
      return savePreferences({
        theme: state.preferences.theme === "dark" ? "light" : "dark",
      });
    case "settings":
      settings();
      break;
    case "shortcuts":
      shortcuts();
      break;
    case "monitor":
      setMonitor(!state.preferences.monitor);
      break;
    case "sessions":
    case "connections":
      setSidebarCollapsed(!state.preferences.sidebarCollapsed);
      break;
    case "collapse-connections":
      setSidebarCollapsed(true);
      break;
    case "transfers":
      setPanel("transfers");
      break;
    case "snippets":
      setPanel("snippets");
      break;
    case "files-collapse":
      $(".files-panel").classList.toggle("collapsed");
      terms.scheduleFit();
      break;
    case "edit-snippets":
      editSnippets();
      break;
    case "split":
      if (state.split) await closeSession(state.split);
      else if (active()?.connected)
        await openHost(active().host.id, { split: true });
      break;
    case "reconnect":
      if (active())
        return openHost(active().host.id, {
          force: true,
          replace: active().id,
        });
      break;
    case "terminal-search":
      $("#terminal-search-bar").hidden = false;
      $("#terminal-search-input").focus();
      break;
    case "close-terminal-search":
      $("#terminal-search-bar").hidden = true;
      terms.clearSearch();
      terms.focus(state.focused || state.active);
      break;
    case "tunnels":
      return tunnels();
    case "log": {
      const s = active();
      if (!s?.connected) return;
      if (s.logPath) {
        await api.StopLogging(s.id);
        s.logPath = null;
        notice("会话日志记录已停止");
      } else {
        s.logPath = await api.StartLogging(s.id);
        if (s.logPath) notice("正在记录会话日志");
      }
      renderToolbar();
      break;
    }
    case "import": {
      const n = await api.ImportConnections();
      if (n) {
        state.hosts = (await api.GetConfig()).hosts;
        renderHosts();
        notice(`已导入 ${n} 个连接`);
      }
      break;
    }
  }
}
function bind() {
  document.addEventListener("click", (e) => {
    const button = e.target.closest("button,[data-tab]");
    if (!button) return;
    let task;
    if (button.dataset.closeTab) task = closeSession(button.dataset.closeTab);
    else if (button.dataset.closePane)
      task = closeSession(button.dataset.closePane);
    else if (button.dataset.host) {
      if (!$("#modal-backdrop").hidden) closeDialog();
      task = openHost(button.dataset.host);
    } else if (button.dataset.editHost) editHost(button.dataset.editHost);
    else if (button.dataset.tab) selectSession(button.dataset.tab);
    else if (button.dataset.group) {
      const group = button.dataset.group;
      state.collapsed.has(group)
        ? state.collapsed.delete(group)
        : state.collapsed.add(group);
      renderHosts();
    } else if (button.dataset.filter) {
      state.filter = button.dataset.filter;
      $$("[data-filter]").forEach((b) =>
        b.classList.toggle("active", b === button),
      );
      renderHosts();
    } else if (button.dataset.panel) setPanel(button.dataset.panel);
    else if (button.dataset.snippet !== undefined) {
      const snippet = state.snippets[Number(button.dataset.snippet)];
      terms.input(state.focused || state.active, snippet.command);
      notice("命令已填入终端，按 Enter 执行");
    } else if (
      button.dataset.action &&
      button.dataset.action !== "close-modal"
    ) {
      if (
        $("#modal").classList.contains("palette") &&
        !$("#modal-backdrop").hidden
      )
        closeDialog();
      task = action(button.dataset.action, button);
    }
    task?.catch?.(fail);
  });
  $("#host-search").oninput = renderHosts;
  $("#terminal-search-input").oninput = (e) => {
    const found = terms.search(state.focused || state.active, e.target.value);
    $("#terminal-search-count").textContent = e.target.value
      ? found
        ? "已找到"
        : "无匹配"
      : "";
  };
  $("#terminal-search-input").onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      terms.search(state.focused || state.active, e.target.value, e.shiftKey);
    }
  };
  document.addEventListener("aster:search", () => action("terminal-search"));
  document.addEventListener("keydown", (e) => {
    if (!$("#modal-backdrop").hidden) return;
    if (e.ctrlKey && e.code === "KeyK") {
      e.preventDefault();
      palette();
    } else if (e.ctrlKey && e.code === "KeyF") {
      e.preventDefault();
      action("terminal-search");
    } else if (e.ctrlKey && e.shiftKey && e.code === "KeyN") {
      e.preventDefault();
      editHost();
    } else if (e.ctrlKey && e.shiftKey && e.code === "KeyB") {
      e.preventDefault();
      setSidebarCollapsed(!state.preferences.sidebarCollapsed);
    } else if (e.key === "Escape" && !$("#terminal-search-bar").hidden) {
      e.preventDefault();
      action("close-terminal-search");
    } else if (
      e.key === "/" &&
      !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) &&
      !document.activeElement.closest(".xterm")
    ) {
      e.preventDefault();
      setSidebarCollapsed(false);
      $("#host-search").focus();
    } else if (
      e.target.matches("[data-tab]") &&
      ["ArrowLeft", "ArrowRight"].includes(e.key)
    ) {
      e.preventDefault();
      const i = state.tabs.indexOf(state.active);
      selectSession(
        state.tabs[
          (i + (e.key === "ArrowLeft" ? -1 : 1) + state.tabs.length) %
            state.tabs.length
        ],
      );
      $(`[data-tab="${state.active}"]`).focus();
    }
  });
  const resizer = $(".files-resizer");
  resizer.onpointerdown = (e) => {
    const start = e.clientY,
      height = $(".files-panel").offsetHeight;
    resizer.setPointerCapture(e.pointerId);
    const move = (event) => {
      $(".files-panel").style.height =
        `${Math.max(120, Math.min($(".main-workspace").clientHeight - 300, height + start - event.clientY))}px`;
      $(".files-panel").classList.remove("collapsed");
    };
    resizer.addEventListener("pointermove", move);
    resizer.addEventListener(
      "pointerup",
      () => resizer.removeEventListener("pointermove", move),
      { once: true },
    );
  };
  resizer.onkeydown = (e) => {
    if (["ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      $(".files-panel").style.height =
        `${Math.max(120, Math.min($(".main-workspace").clientHeight - 300, $(".files-panel").offsetHeight + (e.key === "ArrowUp" ? 20 : -20)))}px`;
    }
  };
}
async function init() {
  decorate();
  initModalKeys();
  bind();
  applyTheme();
  renderHosts();
  renderTabs();
  renderToolbar();
  renderMonitor();
  setSidebarCollapsed(innerWidth <= 720, false);
  if (!window.go?.main?.App) {
    $("#app-state").textContent = "桌面版";
    $("#empty-workspace").innerHTML =
      `<span class="welcome-mark">✳</span><h1>你的服务器，一个自在的工作台。</h1><p>正式版已接入原生 SSH / SFTP。<br>请打开 releases 文件夹中的 AsterSSH.exe。</p>`;
    return;
  }
  try {
    const config = await api.GetConfig();
    state.hosts = config.hosts || [];
    state.preferences = config.preferences;
    files.setDownloadDirectory(state.preferences.downloadDirectory);
    state.snippets = config.snippets || [];
    state.version = config.version;
    state.dataDirectory = config.dataDirectory;
    applyTheme();
    setSidebarCollapsed(
      innerWidth <= 720 || state.preferences.sidebarCollapsed,
      false,
    );
    setMonitor(state.preferences.monitor, false);
    renderHosts();
    renderToolbar();
    renderSnippets();
    renderMonitor();
    window.runtime.EventsOn("terminal:data", (event) => terms.output(event));
    window.runtime.EventsOn("session:status", (event) => {
      if (event.status === "disconnected") {
        const s = state.sessions.get(event.id);
        if (s) {
          s.connected = false;
          s.logPath = null;
          terms.disconnected(event.id, event.message);
          if (
            ![...state.sessions.values()].some(
              (x) => x.connected && x.host.id === s.host.id,
            )
          )
            state.secrets.delete(s.host.id);
          renderTabs();
          renderHosts();
          renderToolbar();
          if (state.active === event.id) {
            files.empty();
            renderMonitor();
          }
        }
      }
    });
    window.runtime.EventsOn("transfer:progress", (event) =>
      files.progress(event),
    );
    window.runtime.EventsOn("notice", (event) => notice(event.message, true));
    window.runtime.EventsOn("files:dropped", (event) => {
      const target = document.elementFromPoint(event.x, event.y);
      if (!target?.closest(".files-panel")) return;
      if (active()?.connected) files.upload(event.paths).catch(fail);
      else notice("请先连接服务器再上传文件", true);
    });
    window.runtime.OnFileDrop(() => {}, true);
    for (const t of await api.GetTransfers()) files.progress(t);
    setInterval(pollStats, 3000);
    $("#app-state").textContent = "本地客户端";
  } catch (error) {
    fail(error);
    $("#app-state").textContent = "载入失败";
  }
}
init();
