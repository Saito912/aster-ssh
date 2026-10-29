// Local-only visual QA server. Fixture data is never included in the application.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { storageView } from "../frontend/src/storage.js";
import { build } from "../frontend/node_modules/esbuild/lib/main.js";

const root = path.resolve(import.meta.dirname, "../frontend/dist");
const port = Number(process.env.PORT || 4174);
const fixture = {
  disks: [
    {
      device: "/dev/mapper/system-root",
      mountpoint: "/",
      filesystem: "ext4",
      total: 210775310336,
      used: 166546374656,
      available: 33690337280,
      percent: 83,
      usageKnown: true,
    },
    {
      device: "/dev/nvme1n1",
      mountpoint: "/data",
      filesystem: "xfs",
      total: 2000000000000,
      used: 400000000000,
      available: 1600000000000,
      percent: 20,
      usageKnown: true,
    },
    {
      device: "/dev/sdb1",
      mountpoint: "/mnt/archive",
      filesystem: "ext4",
      total: 4000000000000,
      used: 900000000000,
      available: 3100000000000,
      percent: 23,
      usageKnown: true,
    },
  ],
  diskInventoryAvailable: true,
  diskDevices: [
    {
      device: "/dev/nvme0n1",
      kind: "disk",
      size: 256000000000,
      state: "mounted",
    },
    {
      device: "/dev/nvme1n1",
      kind: "disk",
      size: 2000000000000,
      state: "mounted",
      filesystem: "xfs",
    },
    { device: "/dev/sdb", kind: "disk", size: 4000000000000, state: "mounted" },
    {
      device: "/dev/sdc",
      kind: "disk",
      size: 4000000000000,
      state: "unmounted",
    },
  ],
};
const storage = storageView(fixture, true);
const fixtureBuild = await build({
  entryPoints: [path.resolve(import.meta.dirname, "theme-fixture.js")],
  bundle: true,
  write: false,
  outfile: "theme-fixture.js",
  target: "es2022",
});
const themeFixture = fixtureBuild.outputFiles.find((file) =>
  file.path.endsWith(".js"),
).contents;
http
  .createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname === "/theme-fixture.js") {
        response.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
        });
        response.end(themeFixture);
        return;
      }
      if (url.pathname === "/layout-fixture.js") {
        response.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
        });
        response.end(
          `document.querySelector('#disk-list').innerHTML=${JSON.stringify(storage.html)};document.querySelector('#disk-count').textContent=${JSON.stringify(storage.count)};document.querySelector('#app-state').textContent='布局验证 · 磁盘示例';`,
        );
        return;
      }
      const themePage = url.pathname === "/theme-fixture";
      const fixturePage =
        themePage || url.pathname === "/layout-storage-fixture";
      const requested =
        fixturePage || url.pathname === "/"
          ? "/index.html"
          : decodeURIComponent(url.pathname);
      const filename = path.resolve(root, `.${requested}`);
      if (!filename.startsWith(root + path.sep)) {
        response.writeHead(403);
        response.end();
        return;
      }
      let body = await fs.readFile(filename);
      if (fixturePage)
        body = body
          .toString("utf8")
          .replace(
            "</head>",
            '<script defer src="/layout-fixture.js"></script></head>',
          );
      if (themePage)
        body = body
          .toString("utf8")
          .replace(
            "</head>",
            '<script defer src="/theme-fixture.js"></script></head>',
          );
      response.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
          }[path.extname(filename)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(
      `Local preview: http://127.0.0.1:${port}/layout-storage-fixture`,
    ),
  );
