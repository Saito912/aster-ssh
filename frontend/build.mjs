import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  outfile: "dist/app.js",
  minify: true,
  target: "es2022",
  legalComments: "eof",
  metafile: false,
});
const html = await readFile("index.html", "utf8");
await writeFile("dist/index.html", html);
console.log("Frontend built: dist/index.html, app.js, app.css");
