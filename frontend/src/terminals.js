import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { $, api, esc, icon, fail, confirmAction, notice } from "./ui.js";
import { terminalTheme } from "./appearance.js";

export class Terminals {
  constructor(preferences, onFocus) {
    this.preferences = preferences;
    this.onFocus = onFocus;
    this.items = new Map();
    this.active = null;
    this.split = null;
    this.fitFrame = 0;
    this.resize = new ResizeObserver(() => this.scheduleFit());
    this.resize.observe($("#terminal-area"));
  }
  add(session) {
    const prefs = this.preferences(),
      term = new Terminal({
        fontFamily:
          '"Cascadia Code", "Cascadia Mono", Consolas, "Microsoft YaHei UI", monospace',
        fontSize: prefs.fontSize,
        lineHeight: 1.25,
        scrollback: prefs.scrollback,
        allowProposedApi: true,
        cursorBlink: true,
        cursorStyle: "bar",
        convertEol: false,
        allowTransparency: false,
        minimumContrastRatio: 4.5,
        theme: terminalTheme(prefs.theme),
      }),
      fit = new FitAddon(),
      search = new SearchAddon();
    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(
      new WebLinksAddon(async (event, url) => {
        event.preventDefault();
        if (
          await confirmAction("打开终端中的链接", url, {
            accept: "在浏览器打开",
          })
        )
          api.OpenExternal(url).catch(fail);
      }),
    );
    const pane = document.createElement("section");
    pane.className = "terminal-pane live-terminal";
    pane.dataset.session = session.id;
    pane.setAttribute("aria-label", `${session.host.name} SSH 终端`);
    pane.innerHTML = `<div class="terminal-pane-heading"><span>SSH</span><span>${esc(session.host.name)}</span><button data-close-pane="${session.id}" title="关闭此终端" aria-label="关闭此终端">${icon("x")}</button></div><div class="xterm-container"></div><div class="terminal-footnote"><span><i></i>SSH · UTF-8 · xterm-256color</span><span class="pane-state">已连接</span></div>`;
    $("#terminal-area").append(pane);
    term.open($(".xterm-container", pane));
    let inputChain = Promise.resolve();
    const send = (data, binary = false) => {
      inputChain = inputChain
        .then(() =>
          binary
            ? api.WriteBinary(session.id, btoa(data))
            : api.WriteSession(session.id, data),
        )
        .catch((error) => {
          if (session.connected) fail(error);
        });
    };
    term.onData((data) => send(data));
    term.onBinary((data) => send(data, true));
    term.onSelectionChange(() => {
      if (this.preferences().copyOnSelect && term.hasSelection())
        window.runtime?.ClipboardSetText(term.getSelection());
    });
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true;
      if (event.ctrlKey && event.shiftKey && event.code === "KeyC") {
        if (term.hasSelection())
          window.runtime?.ClipboardSetText(term.getSelection());
        return false;
      }
      if (event.ctrlKey && event.code === "KeyV") {
        this.paste(session.id);
        return false;
      }
      if (event.ctrlKey && event.code === "KeyF") {
        document.dispatchEvent(new CustomEvent("aster:search"));
        return false;
      }
      if (event.ctrlKey && event.code === "KeyK") return false;
      if (event.ctrlKey && event.shiftKey && event.code === "KeyB")
        return false;
      return true;
    });
    pane.addEventListener("pointerdown", () => this.onFocus(session.id));
    this.items.set(session.id, { term, fit, search, pane, session, send });
    return term;
  }
  async paste(id) {
    const item = this.items.get(id);
    if (!item?.session.connected) return;
    try {
      const text = await window.runtime.ClipboardGetText();
      if (text.length > 1 << 20) {
        notice("单次粘贴不能超过 1 MB", true);
        return;
      }
      if (
        /[\r\n]/.test(text) &&
        !(await confirmAction(
          "粘贴多行内容",
          `即将向终端粘贴 ${text.split(/\r?\n/).length} 行内容，Shell 可能执行其中的命令。`,
          { accept: "粘贴" },
        ))
      )
        return;
      item.term.paste(text);
      item.term.focus();
    } catch (error) {
      fail(error);
    }
  }
  show(active, split) {
    this.active = active;
    this.split = split;
    $("#terminal-area").classList.toggle("is-split", !!split);
    for (const [id, item] of this.items) {
      item.pane.hidden = id !== active && id !== split;
      $(".terminal-pane-heading", item.pane).hidden = !split;
      if (id === active) $("#terminal-area").prepend(item.pane);
      if (id === split) $("#terminal-area").append(item.pane);
    }
    this.scheduleFit();
  }
  scheduleFit() {
    cancelAnimationFrame(this.fitFrame);
    this.fitFrame = requestAnimationFrame(() => {
      for (const id of [this.active, this.split]) {
        const item = this.items.get(id);
        if (
          !item ||
          item.pane.hidden ||
          $(".xterm-container", item.pane).clientWidth < 30
        )
          continue;
        try {
          item.fit.fit();
          if (item.session.connected)
            api
              .ResizeSession(id, item.term.cols, item.term.rows)
              .catch(() => {});
        } catch {
          /* A pane may be disposing while ResizeObserver fires. */
        }
      }
    });
  }
  output(event) {
    const item = this.items.get(event.id);
    if (!item) {
      api.AckOutput(event.id, event.bytes);
      return;
    }
    const bytes = Uint8Array.from(atob(event.data), (ch) => ch.charCodeAt(0));
    item.term.write(bytes, () =>
      api.AckOutput(event.id, event.bytes).catch(() => {}),
    );
  }
  disconnected(id, message) {
    const item = this.items.get(id);
    if (!item) return;
    item.session.connected = false;
    $(".pane-state", item.pane).textContent = "已断开";
    item.pane.classList.add("disconnected");
    item.term.writeln(`\r\n\x1b[90m[${message || "连接已断开"}]\x1b[0m`);
  }
  remove(id) {
    const item = this.items.get(id);
    if (item) {
      item.term.dispose();
      item.pane.remove();
      this.items.delete(id);
    }
  }
  focus(id) {
    this.items.get(id)?.term.focus();
  }
  input(id, text) {
    const item = this.items.get(id);
    if (!item?.session.connected) {
      notice("请先建立 SSH 连接", true);
      return;
    }
    if (/[\r\n\0]/.test(text)) {
      notice("快捷命令仅支持单行，请拆分后保存", true);
      return;
    }
    item.send(text);
    item.term.focus();
  }
  search(id, text, previous = false) {
    const item = this.items.get(id);
    if (!item || !text) return false;
    return previous
      ? item.search.findPrevious(text, {
          decorations: {
            matchBackground: "#71603a",
            matchBorder: "#b09551",
            matchOverviewRuler: "#b09551",
            activeMatchBackground: "#9c7932",
            activeMatchBorder: "#dfb969",
            activeMatchColorOverviewRuler: "#dfb969",
          },
        })
      : item.search.findNext(text, {
          decorations: {
            matchBackground: "#71603a",
            matchBorder: "#b09551",
            matchOverviewRuler: "#b09551",
            activeMatchBackground: "#9c7932",
            activeMatchBorder: "#dfb969",
            activeMatchColorOverviewRuler: "#dfb969",
          },
        });
  }
  clearSearch() {
    for (const item of this.items.values()) item.search.clearDecorations();
  }
  update() {
    const p = this.preferences();
    for (const item of this.items.values()) {
      item.term.options.fontSize = p.fontSize;
      item.term.options.scrollback = p.scrollback;
      item.term.options.theme = terminalTheme(p.theme);
    }
    this.scheduleFit();
  }
  dimensions(id) {
    const item = this.items.get(id);
    if (!item) return { cols: 80, rows: 24 };
    try {
      item.fit.fit();
    } catch {}
    return { cols: item.term.cols, rows: item.term.rows };
  }
}
