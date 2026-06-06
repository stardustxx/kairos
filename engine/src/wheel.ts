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
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
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

function readRequestArg(): string {
  const arg = process.argv[2];
  if (arg?.trim()) return arg;
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
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
  const raw = readRequestArg();
  if (!raw.trim()) {
    console.error(
      'Usage: pnpm wheel \'{"kind":"horary","quesitedHouse":10,"moment":{...}}\'',
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

  await writeFile(join(WEB_DIR, "last-result.json"), JSON.stringify(result, null, 2));

  const port = await serveStatic(START_PORT);
  const url = `http://localhost:${port}/?data=last-result.json`;
  console.log(`\n  Kairos wheel ready → ${url}`);
  console.log("  (serving web/, Ctrl+C to stop)\n");
  openBrowser(url);
}

main();
