import fs from "node:fs";
import { fileURLToPath } from "node:url";

const consoleFileHook = "require_console_file();";
const replacement = "/* Removed Next dev console file hook for Cloudflare Workers. */";

export function stripNextDevConsoleFileImport(worker) {
  return worker.replace(consoleFileHook, replacement);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const workerPath = process.argv[2] ?? ".open-next/server-functions/default/handler.mjs";
  const worker = fs.readFileSync(workerPath, "utf8");

  if (!worker.includes(consoleFileHook)) {
    throw new Error(`Expected ${workerPath} to contain Next's console file hook.`);
  }

  fs.writeFileSync(workerPath, stripNextDevConsoleFileImport(worker));
}
