// Visual QA fixture only; never embedded in the distributed client.
import { Terminals } from "../frontend/src/terminals.js";
import { icon } from "../frontend/src/ui.js";

document.querySelector("#app-state").textContent = "柔和浅色预览 · 示例数据";
document.querySelector("#host-count").textContent = "2";
document.querySelector("#host-groups").innerHTML =
  `<section class="host-group"><div class="group-title">${icon("chevron-down")}开发环境<span class="group-count">2</span></div><div class="host-row"><button class="host-card active"><span class="host-symbol">${icon("server")}<i class="connected"></i></span><span class="host-detail"><strong>dev-web-01</strong><span>192.0.2.10</span></span></button></div><div class="host-row"><button class="host-card"><span class="host-symbol">${icon("server")}<i></i></span><span class="host-detail"><strong>staging-api</strong><span>192.0.2.20</span></span></button></div></section>`;
document.querySelector("#tabs").innerHTML =
  `<div class="session-tab active"><i></i><span>dev-web-01</span><button aria-label="预览标签">${icon("x")}</button></div>`;
document.querySelector("#toolbar-name").textContent = "dev-web-01";
document.querySelector("#session-address").textContent = "dev@192.0.2.10:22";
document.querySelector("#environment-label").hidden = false;
document.querySelector("#environment-label").textContent = "开发环境";
document.querySelector("#latency").textContent = "配色预览";
document.querySelector("#empty-workspace").hidden = true;
document.querySelector("#terminal-area").classList.add("has-session");
const terminals = new Terminals(
  () => ({
    theme: document.body.classList.contains("dark") ? "dark" : "light",
    fontSize: 14,
    scrollback: 1000,
    copyOnSelect: false,
  }),
  () => {},
);
const session = {
  id: "theme-preview",
  host: { name: "dev-web-01" },
  connected: false,
};
const terminal = terminals.add(session);
terminals.show(session.id, null);
new MutationObserver(() => terminals.update()).observe(document.body, {
  attributes: true,
  attributeFilter: ["class"],
});
document.querySelector(".pane-state").textContent = "常用 ANSI 配色示例";
terminal.write(
  "\x1b[90mUbuntu 24.04 LTS · Aster SSH theme preview\x1b[0m\r\n\r\n",
);
terminal.write(
  "\x1b[32mdev@dev-web-01\x1b[0m \x1b[34m~/workspace\x1b[0m $ ls -lah\r\n",
);
terminal.write(
  "\x1b[90mdrwxr-xr-x  4 dev dev  4096 Oct 29 10:24\x1b[0m  \x1b[34mapp/\x1b[0m\r\n",
);
terminal.write(
  "\x1b[90mdrwxr-xr-x  2 dev dev  4096 Oct 29 09:10\x1b[0m  \x1b[34mlogs/\x1b[0m\r\n",
);
terminal.write(
  "\x1b[90m-rw-r--r--  1 dev dev  1248 Oct 28 18:36\x1b[0m  README.md\r\n\r\n",
);
terminal.write(
  "\x1b[32mdev@dev-web-01\x1b[0m \x1b[34m~/workspace\x1b[0m $ docker compose ps\r\n",
);
terminal.write(
  "\x1b[90mNAME          IMAGE              STATUS\x1b[0m\r\nweb           nginx:alpine       \x1b[32mUp 2 days (healthy)\x1b[0m\r\napi           node:22-alpine     \x1b[32mUp 2 days (healthy)\x1b[0m\r\n\r\n",
);
terminal.write(
  "\x1b[33mwarning\x1b[0m  低饱和提示色      \x1b[31merror\x1b[0m  错误仍保持可辨识\r\n",
);
terminal.write(
  "\x1b[90m浅灰背景搭配深灰文字，面板与终端统一配色。\x1b[0m\r\n\r\n",
);
terminal.write("\x1b[32mdev@dev-web-01\x1b[0m \x1b[34m~/workspace\x1b[0m $ ");
document.querySelector("#monitor-host").textContent = "dev-web-01";
document.querySelector("#monitor-os").textContent =
  "Ubuntu 24.04 LTS · 配色示例";
document.querySelector("#cpu-value").textContent = "14.2";
document.querySelector("#memory-value").textContent = "38.6";
document.querySelector(".memory-bar>span").style.width = "38.6%";
document
  .querySelector(".cpu-chart .line")
  .setAttribute(
    "d",
    "M0 35 L16 32 L32 34 L48 24 L64 29 L80 32 L96 27 L112 33 L128 28 L144 30 L160 22 L176 29 L192 26 L208 31 L220 28",
  );
document
  .querySelector(".network-chart .line")
  .setAttribute(
    "d",
    "M0 30 L20 31 L40 22 L60 27 L80 25 L100 29 L120 19 L140 27 L160 23 L180 28 L200 24 L220 26",
  );
document.querySelector("#file-list").innerHTML = [
  ["app", "folder", "—", "drwxr-xr-x"],
  ["logs", "folder", "—", "drwxr-xr-x"],
  ["deploy.sh", "script", "1.2 KB", "-rwxr-xr-x"],
  ["README.md", "file", "864 B", "-rw-r--r--"],
]
  .map(
    ([name, type, size, mode]) =>
      `<tr><td><button class="file-name ${type}">${icon(type === "folder" ? "folder" : type === "script" ? "code" : "file")}<span>${name}</span></button></td><td>${size}</td><td>2026-10-29 10:24</td><td>${mode}</td><td class="file-row-actions">${icon("download")}</td></tr>`,
  )
  .join("");
document.querySelector("#file-summary").textContent = "2 个文件夹，2 个文件";
