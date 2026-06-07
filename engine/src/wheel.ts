/*
 * wheel.ts — one-shot helper: compute a request, then open the chart wheel in a
 * browser pre-loaded with the result.
 *
 *   pnpm wheel '{"kind":"horary","quesitedHouse":10,"moment":{...}}'
 *   pnpm wheel '{"kind":"electional", ...}'   # renders the #1 elected chart
 *
 * It writes web/last-result.json, starts a tiny static server over web/, and
 * opens http://localhost:<port>/?data=last-result.json (the web app auto-loads
 * that file). Leave it running; Ctrl+C to stop.
 *
 * Non-blocking render mode:
 *
 *   pnpm wheel --write '{"kind":"horary",...}'        # default temp path
 *   pnpm wheel --write /abs/out.html '{"kind":...}'   # explicit path
 *
 * With --write (or -w) it instead writes ONE self-contained, openable .html
 * artifact (the web/ assets and the ComputeResult inlined), prints that file's
 * absolute path to stdout, and exits 0 WITHOUT starting any server. The `pnpm
 * wheel:render` script wraps `--write` for the skill.
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCompute } from "./cli.js";
import type { ComputeRequest, ComputeResult } from "./types.js";

const WEB_DIR = join(fileURLToPath(import.meta.url), "..", "..", "..", "web");
const START_PORT = 8765;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

interface Cli {
  writeMode: boolean;
  outPath?: string;
  requestArg?: string;
}

function parseArgs(argv: string[]): Cli {
  const args = argv.slice(2);
  let writeMode = false;
  let outPath: string | undefined;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--write" || a === "-w") {
      writeMode = true;
      // Optional next token is the output path IF it is not the JSON request
      // (JSON requests start with '{'). Otherwise default path is used.
      const next = args[i + 1];
      if (next && !next.trimStart().startsWith("{")) {
        outPath = next;
        i++;
      }
    } else {
      rest.push(a);
    }
  }
  return { writeMode, outPath, requestArg: rest[0] };
}

function readRequestArg(arg?: string): string {
  if (arg?.trim()) return arg;
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/**
 * Assemble ONE self-contained HTML artifact by inlining the existing web/ assets
 * (style.css, chart.js, app.js) into index.html, plus the ComputeResult JSON and
 * a bootstrap that fills #json-input and clicks #render-btn. Nothing is fetched,
 * so it renders offline under file:// (sidesteps the fetch() block; see
 * web/README.md). The existing renderer is reused verbatim — no rewrite.
 */
function buildSelfContainedHtml(result: ComputeResult): string {
  const css = readFileSync(join(WEB_DIR, "style.css"), "utf8");
  const chartJs = readFileSync(join(WEB_DIR, "chart.js"), "utf8");
  const appJs = readFileSync(join(WEB_DIR, "app.js"), "utf8");
  let html = readFileSync(join(WEB_DIR, "index.html"), "utf8");

  // 1. Inline the stylesheet (replace the <link rel=stylesheet href=style.css/>).
  let before = html;
  // Use a function replacer (not a string): inlined asset bodies contain `$`
  // sequences (e.g. `\\$&` in app.js) that String.replace would treat as
  // special replacement patterns, corrupting the output. A replacer function
  // returns the text verbatim with no `$` interpretation.
  html = html.replace(
    /<link\s+rel="stylesheet"\s+href="style\.css"\s*\/>/,
    () => `<style>\n${css}\n</style>`,
  );
  if (html === before) {
    throw new Error(
      "asset inlining anchor not found in index.html: <link rel=\"stylesheet\" href=\"style.css\" />",
    );
  }

  // 2. Inline chart.js + app.js (replace the two <script src> tags), and inject
  //    the ComputeResult + a bootstrap that fills the textarea and clicks Render.
  //    app.js's start() only auto-loads on ?data=, which is absent under file://,
  //    so we drive the existing #render-btn directly after start() has wired it.
  //    Escape '<' in the inlined JSON so a literal </script> can't close the tag.
  const dataJson = JSON.stringify(result).replace(/</g, "\\u003c");
  const bootstrap =
    `<script id="kairos-data" type="application/json">${dataJson}</script>\n` +
    "<script>\n" +
    "(function(){\n" +
    "  var el=document.getElementById('kairos-data');\n" +
    "  var ta=document.getElementById('json-input');\n" +
    "  ta.value=el.textContent;\n" +
    "  document.getElementById('render-btn').click();\n" +
    "})();\n" +
    "</script>";
  before = html;
  html = html.replace(
    /<script\s+src="chart\.js"><\/script>\s*<script\s+src="app\.js"><\/script>/,
    () => `<script>\n${chartJs}\n</script>\n<script>\n${appJs}\n</script>\n${bootstrap}`,
  );
  if (html === before) {
    throw new Error(
      "asset inlining anchor not found in index.html: <script src=\"chart.js\"></script><script src=\"app.js\"></script>",
    );
  }

  return html;
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    /* fall through to the printed URL */
  }
}

function serveStatic(port: number): Promise<number> {
  const server = createServer(async (req, res) => {
    try {
      // Strip query string, prevent path traversal, default to index.html.
      const rawPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
      const rel = normalize(rawPath).replace(/^(\.\.[/\\])+/, "");
      const filePath = join(WEB_DIR, rel === "/" ? "index.html" : rel);
      if (!filePath.startsWith(WEB_DIR)) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      const body = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" && port < START_PORT + 20) {
        resolve(serveStatic(port + 1));
      } else {
        reject(err);
      }
    });
    server.listen(port, () => resolve(port));
  });
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv);
  const raw = readRequestArg(cli.requestArg);
  if (!raw.trim()) {
    console.error(
      'Usage: pnpm wheel [--write [out.html]] \'{"kind":"horary","quesitedHouse":10,"moment":{...}}\'',
    );
    process.exit(1);
  }

  let result: ComputeResult;
  try {
    const req = JSON.parse(raw) as ComputeRequest;
    result = runCompute(req);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }

  if (!result.chart) {
    console.error(
      "Nothing to render: this request produced no chart (an electional with no candidates?).",
    );
    process.exit(1);
  }

  // Non-blocking render mode: write a single self-contained artifact and exit
  // BEFORE any server work, so no socket is opened and the process terminates.
  if (cli.writeMode) {
    const out = cli.outPath
      ? resolve(cli.outPath)
      : join(tmpdir(), `kairos-chart-${Date.now()}.html`);
    const htmlDoc = buildSelfContainedHtml(result);
    await writeFile(out, htmlDoc, "utf8");
    console.log(out); // absolute path, sole stdout line for the skill
    process.exit(0); // never start the server; never block
  }

  // --- existing blocking-server behavior, unchanged ---
  await writeFile(join(WEB_DIR, "last-result.json"), JSON.stringify(result, null, 2));

  const port = await serveStatic(START_PORT);
  const url = `http://localhost:${port}/?data=last-result.json`;
  console.log(`\n  Kairos wheel ready → ${url}`);
  console.log("  (serving web/, Ctrl+C to stop)\n");
  openBrowser(url);
}

main();
