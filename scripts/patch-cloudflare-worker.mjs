import fs from "node:fs";
import { fileURLToPath } from "node:url";

const consoleFileHook = "require_console_file();";
const consoleDimHook = "require_console_dim_external();";
const consoleDimImport = "require_console_dim_external()";
const nodeCryptoHook = "require_node_crypto();";
const replacement = "/* Removed Next dev console hook for Cloudflare Workers. */";
const consoleDimReplacement = "/* Removed Next dev console dim hook for Cloudflare Workers. */";
const consoleDimShim = "({ setAbortedLogsStyle() {} })";
const nodeCryptoReplacement = "/* Removed Next Node crypto patch for Cloudflare Workers. */";

export function stripNextDevConsoleFileImport(worker) {
  return worker
    .replace(consoleFileHook, replacement)
    .replace(consoleDimHook, consoleDimReplacement)
    .replace(consoleDimImport, consoleDimShim)
    .replace(nodeCryptoHook, nodeCryptoReplacement);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const workerPath = process.argv[2] ?? ".open-next/server-functions/default/handler.mjs";
  const worker = fs.readFileSync(workerPath, "utf8");

  if (!worker.includes(consoleFileHook)) {
    throw new Error(`Expected ${workerPath} to contain Next's console file hook.`);
  }

  fs.writeFileSync(workerPath, stripNextDevConsoleFileImport(worker));
}
