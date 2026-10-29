import {
  $,
  $$,
  api,
  esc,
  icon,
  notice,
  fail,
  dialog,
  closeDialog,
  heading,
  confirmAction,
  askName,
  busy,
  bytes,
  joinPath,
} from "./ui.js";

export class Files {
  constructor(current, onPanel, onDownloadDirectory) {
    this.current = current;
    this.onPanel = onPanel;
    this.onDownloadDirectory = onDownloadDirectory;
    this.downloadDirectory = "";
    this.preparingDownload = false;
    this.sort = { key: "name", direction: 1 };
    this.showHidden = false;
    this.transfers = new Map();
    this.pendingRender = 0;
    this.generation = 0;
    this.bind();
    this.empty();
  }
  empty() {
    $("#file-path").innerHTML = "<span>未连接</span>";
    $("#file-list").innerHTML =
      '<tr><td colspan="5" class="empty-row">建立 SSH 连接后，在这里浏览远程文件</td></tr>';
    $("#file-summary").textContent = "SFTP 文件管理";
    $("#sftp-status").textContent = "等待连接";
  }
  async load(path, session = this.current()) {
    if (!session?.connected) {
      this.empty();
      return;
    }
    const generation = ++this.generation;
    $("#file-list").innerHTML =
      '<tr><td colspan="5" class="empty-row">正在读取远程目录…</td></tr>';
    try {
      const result = await api.ListFiles(
        session.id,
        path || session.directory?.path || ".",
      );
      session.directory = result;
      if (generation === this.generation && session === this.current()) {
        this.render();
        $("#sftp-status").textContent = "SFTP 已就绪";
      }
    } catch (error) {
      if (generation === this.generation && session === this.current()) {
        $("#file-list").innerHTML =
          `<tr><td colspan="5" class="empty-row file-error">${esc(error.message || error)}<br><button class="text-button" data-file-action="refresh">重试</button></td></tr>`;
        $("#sftp-status").textContent = "SFTP 不可用";
      }
    }
  }
  show() {
    ++this.generation;
    const s = this.current();
    if (!s?.connected) {
      this.empty();
      return;
    }
    if (s.directory) this.render();
    else this.load();
  }
  render() {
    const s = this.current(),
      directory = s?.directory;
    if (!directory) {
      this.empty();
      return;
    }
    const parts = directory.path.split("/").filter(Boolean);
    $("#file-path").innerHTML =
      `<button data-path="/">/</button>` +
      parts
        .map(
          (part, i) =>
            `${icon("chevron-right")}<button data-path="/${esc(parts.slice(0, i + 1).join("/"))}">${esc(part)}</button>`,
        )
        .join("");
    $("#file-path").title = directory.path;
    let files = directory.files.filter(
      (f) => this.showHidden || !f.name.startsWith("."),
    );
    files = [...files].sort((a, b) => {
      if ((a.type === "folder") !== (b.type === "folder"))
        return a.type === "folder" ? -1 : 1;
      let diff =
        this.sort.key === "name"
          ? a.name.localeCompare(b.name)
          : a[this.sort.key] - b[this.sort.key];
      return diff * this.sort.direction;
    });
    $("#file-list").innerHTML =
      files
        .map(
          (f) =>
            `<tr><td><button class="file-name ${f.type}" data-file="${esc(f.name)}" title="${f.type === "folder" ? "打开文件夹" : "预览 UTF-8 文本"}">${icon(f.type === "folder" ? "folder" : f.type === "script" ? "code" : "file")}<span>${esc(f.name)}</span></button></td><td>${f.type === "folder" ? "—" : bytes(f.size)}</td><td>${new Date(f.modified).toLocaleString("sv-SE").slice(0, 16)}</td><td>${esc(f.mode)}</td><td class="file-row-actions"><div><button class="icon-button" data-file-download="${esc(f.name)}" title="下载文件" aria-label="下载 ${esc(f.name)}">${icon("download")}</button><button class="icon-button file-more" data-file-menu="${esc(f.name)}" title="文件操作" aria-label="${esc(f.name)} 文件操作">···</button></div></td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="5" class="empty-row">目录为空，或文件已被隐藏</td></tr>';
    $("#file-summary").textContent =
      `${files.filter((f) => f.type === "folder").length} 个文件夹，${files.filter((f) => f.type !== "folder").length} 个文件`;
    $("#toggle-hidden")?.classList.toggle("selected", this.showHidden);
  }
  async open(name) {
    const s = this.current(),
      f = s?.directory?.files.find((f) => f.name === name);
    if (!f) return;
    if (f.type === "folder") {
      await this.load(joinPath(s.directory.path, name), s);
      return;
    }
    const file = await api.ReadRemoteFile(
      s.id,
      joinPath(s.directory.path, name),
    );
    this.editor(s, file);
  }
  editor(s, file) {
    dialog(
      `${heading(file.path.split("/").pop())}<p class="modal-description editor-path">${esc(file.path)} · UTF-8 · ${bytes(file.size)}</p><form id="editor-form" class="modal-form"><label>文件内容<textarea name="content" spellcheck="false" aria-label="远程文件内容">${esc(file.content)}</textarea></label><p class="editor-status">保存前检查远程文件版本，使用临时文件与原子替换。</p><div class="modal-actions"><button type="button" class="button-secondary" data-action="close-modal">关闭</button><button type="submit" class="button-primary">保存到服务器</button></div></form>`,
    );
    $("#modal").classList.add("editor-modal");
    let dirty = false;
    $("#editor-form textarea").addEventListener("input", () => {
      dirty = true;
      $(".editor-status").textContent = "有未保存的修改";
    });
    $("#editor-form").onsubmit = (e) => {
      e.preventDefault();
      const content = new FormData(e.target).get("content");
      busy(e.submitter, async () => {
        const updated = await api.WriteRemoteFile(s.id, { ...file, content });
        file = updated;
        dirty = false;
        $(".editor-status").textContent = "已保存到服务器";
        notice("远程文件已保存");
        this.load(s.directory.path, s);
      });
    };
    const cancelButtons = $$('[data-action="close-modal"]', $("#modal"));
    for (const b of cancelButtons)
      b.addEventListener("click", (e) => {
        if (
          dirty &&
          !window.confirm("文件有未保存的修改，确定关闭编辑器吗？")
        ) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
  }
  async menu(name) {
    const s = this.current(),
      f = s?.directory?.files.find((f) => f.name === name);
    if (!f) return;
    const target = joinPath(s.directory.path, name);
    dialog(
      `${heading(name)}<p class="modal-description">${esc(target)}<br>${esc(f.mode)} · ${f.type === "folder" ? "文件夹" : bytes(f.size)}</p><div class="file-operation-list"><button id="file-menu-open">${icon(f.type === "folder" ? "folder" : "edit")}${f.type === "folder" ? "打开文件夹" : "预览与编辑"}</button><button id="file-menu-download">${icon("download")}下载${f.type === "folder" ? "文件夹" : "文件"}</button><button id="file-menu-rename">${icon("edit")}重命名</button><button id="file-menu-remove" class="danger-text">${icon("x")}${f.type === "folder" ? "删除空文件夹" : "删除文件"}</button></div>`,
    );
    $("#file-menu-open").onclick = () => {
      closeDialog();
      this.open(name).catch(fail);
    };
    $("#file-menu-download")?.addEventListener("click", () => {
      closeDialog();
      this.download(name).catch(fail);
    });
    $("#file-menu-rename").onclick = async () => {
      const value = await askName("重命名", name);
      if (value && value !== name) {
        try {
          await api.RenameRemote(
            s.id,
            target,
            joinPath(s.directory.path, value),
          );
          notice("重命名完成");
          this.load(s.directory.path, s);
        } catch (error) {
          fail(error);
        }
      }
    };
    $("#file-menu-remove").onclick = async () => {
      if (
        await confirmAction(
          "永久删除远程文件",
          `将永久删除 ${target}。此操作无法撤销。${f.type === "folder" ? "仅能删除空文件夹。" : ""}`,
          { accept: "永久删除", danger: true },
        )
      ) {
        try {
          await api.RemoveRemote(s.id, target);
          notice("远程条目已删除");
          this.load(s.directory.path, s);
        } catch (error) {
          fail(error);
        }
      }
    };
  }
  setDownloadDirectory(value) {
    this.downloadDirectory = value || "";
    const button = $("#download-directory");
    if (button) {
      button.title = this.downloadDirectory || "选择本地接收目录";
      button.innerHTML =
        icon("folder") +
        "<span>接收目录：" +
        esc(this.downloadDirectory || "点击选择") +
        "</span>";
    }
  }
  async chooseDownloadDirectory() {
    const value = await api.ChooseDownloadDirectory();
    if (value) {
      this.setDownloadDirectory(value);
      this.onDownloadDirectory?.(value);
    }
    return value;
  }
  async download(name) {
    const s = this.current();
    if (!s?.connected) return;
    if (this.preparingDownload) {
      notice("正在准备下载，请稍候");
      return;
    }
    this.preparingDownload = true;
    try {
      if (!this.downloadDirectory && !(await this.chooseDownloadDirectory()))
        return;
      const remote = joinPath(s.directory.path, name);
      notice("正在读取传输清单…");
      const targets = await api.CheckDownloads(s.id, [remote]);
      const conflicts = targets.filter((t) => t.exists);
      if (
        conflicts.length &&
        !(await confirmAction(
          "确认合并或覆盖",
          conflicts
            .map((t) =>
              t.directory
                ? "合并文件夹 " +
                  t.name +
                  "，覆盖其中 " +
                  t.conflicts +
                  " 个同名文件"
                : "覆盖本地文件 " + t.name,
            )
            .join("；") +
            "。接收目录：" +
            this.downloadDirectory,
          { accept: "开始传输", danger: true },
        ))
      )
        return;
      const jobs = await api.StartDownloads(
        s.id,
        [remote],
        conflicts.length > 0,
      );
      jobs.forEach((t) => this.progress(t));
      this.onPanel("transfers");
    } finally {
      this.preparingDownload = false;
    }
  }
  uploadMenu() {
    if (!this.current()?.connected) {
      notice("请先连接服务器", true);
      return;
    }
    dialog(
      heading("上传到当前远程目录") +
        '<p class="modal-description">文件保持原名，文件夹保留完整目录结构。</p><div class="file-operation-list"><button id="pick-upload-files">' +
        icon("file") +
        '选择文件（可多选）</button><button id="pick-upload-folder">' +
        icon("folder") +
        "选择文件夹</button></div>",
    );
    $("#pick-upload-files").onclick = () => {
      closeDialog();
      this.upload().catch(fail);
    };
    $("#pick-upload-folder").onclick = async () => {
      closeDialog();
      try {
        const directory = await api.ChooseUploadFolder();
        if (directory) await this.upload([directory]);
      } catch (error) {
        fail(error);
      }
    };
  }
  async upload(paths) {
    const s = this.current();
    if (!s?.connected) {
      notice("请先连接服务器", true);
      return;
    }
    if (!s.directory) await this.load(".", s);
    if (!s.directory) return;
    const picked = paths
      ? paths.map((p) => ({ path: p }))
      : await api.ChooseUploadFiles();
    if (!picked.length) return;
    const directory = s.directory.path;
    const checks = await api.CheckUploads(
      s.id,
      directory,
      picked.map((f) => f.path),
    );
    const duplicates = checks.filter((f) => f.exists);
    if (
      duplicates.length &&
      !(await confirmAction(
        "确认覆盖远程文件",
        duplicates
          .map((f) =>
            f.directory
              ? "合并文件夹 " + f.name + "，覆盖 " + f.conflicts + " 个同名文件"
              : "覆盖文件 " + f.name,
          )
          .join("；"),
        { accept: "覆盖并上传", danger: true },
      ))
    )
      return;
    const jobs = await api.StartUploads(
      s.id,
      directory,
      picked.map((f) => f.path),
      duplicates.length > 0,
    );
    jobs.forEach((j) => this.progress(j));
    this.onPanel("transfers");
  }
  progress(t) {
    const old = this.transfers.get(t.id);
    if (
      old &&
      ["completed", "failed", "cancelled"].includes(old.status) &&
      ["queued", "running"].includes(t.status)
    )
      return;
    this.transfers.set(t.id, t);
    if (t.status === "completed" && old?.status !== "completed") {
      const s = this.current();
      if (
        s?.id === t.sessionId &&
        s.directory?.path ===
          t.remotePath.slice(0, t.remotePath.lastIndexOf("/"))
      )
        this.load(s.directory.path, s);
      notice(`${t.direction === "upload" ? "上传" : "下载"}完成：${t.name}`);
    }
    if (t.status === "failed" && old?.status !== "failed")
      notice(`${t.name}：${t.error}`, true);
    $("#transfer-count").textContent = [...this.transfers.values()].filter(
      (t) => ["running", "queued"].includes(t.status),
    ).length;
    $(".rail-notification").hidden = !+$("#transfer-count").textContent;
    cancelAnimationFrame(this.pendingRender);
    this.pendingRender = requestAnimationFrame(() => {
      if (!$("#transfers-view").hidden) this.renderTransfers();
    });
  }
  renderTransfers() {
    const jobs = [...this.transfers.values()].sort(
      (a, b) => b.started - a.started,
    );
    $("#transfers-view").innerHTML = jobs.length
      ? `<div class="transfer-list">${jobs.map((t) => `<div class="transfer-item"><span>${icon(t.direction === "upload" ? "upload" : "download")}</span><div class="transfer-info"><div><span>${esc(t.name)}</span><small>${{ queued: "排队中", running: `${t.total ? Math.min(100, Math.floor((100 * t.done) / t.total)) : 0}%`, completed: "已完成", failed: "失败", cancelled: "已取消" }[t.status]} · ${bytes(t.done)} / ${bytes(t.total)}</small></div><div class="progress-track"><span style="width:${t.status === "completed" ? 100 : t.total ? Math.min(100, (100 * t.done) / t.total) : 0}%;${t.status === "failed" ? "background:#d48080" : ""}"></span></div><div class="transfer-direction">${t.direction === "upload" ? "本地 → 远程" : "远程 → 本地"} ${esc(t.hostName)} · ${esc(t.remotePath)}<br>本地：${esc(t.localPath)}${t.directory ? "<br>目录进度：" + t.entriesDone + " / " + t.entries + " 项" : ""}${t.error ? `<br><span class="danger-text">${esc(t.error)}</span>` : ""}</div></div>${["queued", "running"].includes(t.status) ? `<button class="icon-button" data-cancel-transfer="${t.id}" title="取消传输" aria-label="取消传输">${icon("x")}</button>` : t.status === "completed" && t.direction === "download" ? '<button class="icon-button" data-open-transfer="' + t.id + '" title="打开接收位置">' + icon("folder") + "</button>" : icon(t.status === "completed" ? "check" : "x")}</div>`).join("")}</div>`
      : `<div class="empty-state">${icon("transfer")}<span>所有文件，都有迹可循</span><p>上传、下载的实际进度会显示在这里</p><button class="text-button primary-soft" data-file-action="upload">${icon("upload")}上传文件</button></div>`;
  }
  async action(action) {
    const s = this.current();
    switch (action) {
      case "refresh":
        return this.load();
      case "up":
        if (s?.directory) {
          const parent =
            s.directory.path.slice(0, s.directory.path.lastIndexOf("/")) || "/";
          return this.load(parent);
        }
        break;
      case "home":
        return this.load(s?.directory?.home || ".");
      case "path": {
        if (!s?.connected) return;
        const name = await new Promise((resolve) => {
          dialog(
            `${heading("跳转目录")}<form id="path-form" class="modal-form" style="margin-top:18px"><label>远程路径<input id="path-input" value="${esc(s.directory?.path || "/")}" required></label><div class="modal-actions"><button class="button-primary" type="submit">前往</button></div></form>`,
          );
          $("#path-form").onsubmit = (e) => {
            e.preventDefault();
            const p = $("#path-input").value;
            closeDialog();
            resolve(p);
          };
        });
        return this.load(name);
      }
      case "hidden":
        this.showHidden = !this.showHidden;
        this.render();
        break;
      case "upload":
        return this.uploadMenu();
      case "download-directory":
        return this.chooseDownloadDirectory();
      case "new-folder":
        if (!s?.connected) {
          notice("请先连接服务器", true);
          return;
        }
        if (!s.directory) await this.load(".", s);
        const name = await askName("新建远程文件夹");
        if (name) {
          await api.MakeDirectory(s.id, joinPath(s.directory.path, name));
          notice("远程文件夹已创建");
          return this.load();
        }
        break;
    }
  }
  bind() {
    document.addEventListener("click", (event) => {
      const b = event.target.closest("button");
      if (!b) return;
      let task;
      if (b.dataset.file) task = this.open(b.dataset.file);
      else if (b.dataset.path) task = this.load(b.dataset.path);
      else if (b.dataset.fileDownload)
        task = this.download(b.dataset.fileDownload);
      else if (b.dataset.fileMenu) task = this.menu(b.dataset.fileMenu);
      else if (b.dataset.fileAction) task = this.action(b.dataset.fileAction);
      else if (b.dataset.cancelTransfer)
        task = api.CancelTransfer(b.dataset.cancelTransfer);
      else if (b.dataset.openTransfer)
        task = api.OpenTransferLocation(b.dataset.openTransfer);
      else if (b.dataset.sort) {
        const key = b.dataset.sort === "date" ? "modified" : b.dataset.sort;
        this.sort = {
          key,
          direction: this.sort.key === key ? -this.sort.direction : 1,
        };
        this.render();
      }
      task?.catch?.(fail);
    });
  }
}
