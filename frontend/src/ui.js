import { ICONS } from "./icons.js";
export const $ = (q, root = document) => root.querySelector(q);
export const $$ = (q, root = document) => [...root.querySelectorAll(q)];
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
export const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;
export const decorate = (root = document) =>
  $$("[data-icon]", root).forEach(
    (el) => (el.innerHTML = icon(el.dataset.icon)),
  );
export const api = new Proxy(
  {},
  {
    get:
      (_, method) =>
      (...args) => {
        const fn = window.go?.main?.App?.[method];
        if (!fn)
          return Promise.reject(
            new Error("请使用 AsterSSH.exe 打开正式客户端"),
          );
        return fn(...args);
      },
  },
);
export const message = (error) =>
  typeof error === "string" ? error : error?.message || String(error);
export function notice(text, error = false) {
  const el = document.createElement("div");
  el.className = `toast ${error ? "error" : ""}`;
  el.innerHTML = icon(error ? "info" : "check") + `<span>${esc(text)}</span>`;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), error ? 6500 : 3500);
}
export function fail(error) {
  notice(message(error), true);
}
let afterClose, returnFocus;
export function dialog(html, { palette = false, onCancel } = {}) {
  if (!$("#modal-backdrop").hidden) closeDialog();
  returnFocus = document.activeElement;
  afterClose = onCancel;
  $("#modal").className = `modal${palette ? " palette" : ""}`;
  $("#modal").innerHTML = html;
  $("#modal-backdrop").hidden = false;
  requestAnimationFrame(() =>
    (
      $('#modal input:not([type="hidden"])') ||
      $("#modal textarea") ||
      $("#modal button")
    )?.focus(),
  );
}
export function closeDialog(cancel = true) {
  $("#modal-backdrop").hidden = true;
  $("#modal").replaceChildren();
  const callback = afterClose;
  afterClose = null;
  if (cancel) callback?.();
  returnFocus?.isConnected && returnFocus.focus();
}
export const heading = (title) =>
  `<div class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭弹窗">${icon("x")}</button></div>`;
export function confirmAction(
  title,
  text,
  { accept = "确认", danger = false } = {},
) {
  return new Promise((resolve) => {
    dialog(
      `${heading(title)}<p class="modal-description">${esc(text)}</p><div class="modal-actions"><button class="button-secondary" id="confirm-no">取消</button><button class="button-primary ${danger ? "danger" : ""}" id="confirm-yes">${esc(accept)}</button></div>`,
      { onCancel: () => resolve(false) },
    );
    $("#confirm-no").onclick = () => {
      closeDialog(false);
      resolve(false);
    };
    $("#confirm-yes").onclick = () => {
      closeDialog(false);
      resolve(true);
    };
  });
}
export function askName(title, value = "") {
  return new Promise((resolve) => {
    dialog(
      `${heading(title)}<form id="ask-name" class="modal-form" style="margin-top:18px"><label>名称<input id="name-value" value="${esc(value)}" maxlength="150" required></label><div class="modal-actions"><button type="button" class="button-secondary" data-action="close-modal">取消</button><button type="submit" class="button-primary">确定</button></div></form>`,
      { onCancel: () => resolve(null) },
    );
    $("#ask-name").onsubmit = (e) => {
      e.preventDefault();
      const name = $("#name-value").value.trim();
      if (!name || name === "." || name === ".." || /[\/\\\0]/.test(name)) {
        notice("请输入有效名称，名称中不能包含斜杠", true);
        return;
      }
      closeDialog(false);
      resolve(name);
    };
  });
}
export async function busy(button, operation) {
  if (button?.disabled) return;
  const old = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.textContent = "处理中…";
  }
  try {
    return await operation();
  } catch (error) {
    fail(error);
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.innerHTML = old;
    }
  }
}
export function bytes(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  n = Number(n);
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}
export const joinPath = (base, name) => `${base === "/" ? "" : base}/${name}`;
export function initModalKeys() {
  document.addEventListener("click", (e) => {
    if (
      e.target === $("#modal-backdrop") ||
      e.target.closest('[data-action="close-modal"]')
    )
      closeDialog();
  });
  document.addEventListener("keydown", (e) => {
    if ($("#modal-backdrop").hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeDialog();
    }
    if (e.key === "Tab") {
      const fields = $$(
        'button,input,select,textarea,[tabindex="0"]',
        $("#modal"),
      ).filter((el) => !el.disabled && el.getBoundingClientRect().height > 0);
      const first = fields[0],
        last = fields.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
}
