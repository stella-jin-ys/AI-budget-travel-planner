import fs from "node:fs";
import { fileURLToPath } from "node:url";

const consoleFileHook = "require_console_file();";
const consoleDimHook = "require_console_dim_external();";
const consoleDimImport = "require_console_dim_external()";
const nodeCryptoHook = "require_node_crypto();";
const fastSetImmediateImport = "require_fast_set_immediate_external()";
const replacement = "/* Removed Next dev console hook for Cloudflare Workers. */";
const consoleDimReplacement = "/* Removed Next dev console dim hook for Cloudflare Workers. */";
const consoleDimShim = "({ setAbortedLogsStyle() {} })";
const nodeCryptoReplacement = "/* Removed Next Node crypto patch for Cloudflare Workers. */";
const fastSetImmediateReplacement = "/* Removed Next fast setImmediate patch for Cloudflare Workers. */";
const fastSetImmediateShim = "({ unpatchedSetImmediate: (callback) => setTimeout(callback, 0) });";

export function stripNextDevConsoleFileImport(worker) {
  return worker
    .replace(consoleFileHook, replacement)
    .replace(consoleDimHook, consoleDimReplacement)
    .replace(consoleDimImport, consoleDimShim)
    .replace(nodeCryptoHook, nodeCryptoReplacement)
    .replace(fastSetImmediateImport, fastSetImmediateReplacement)
    .replace(fastSetImmediateImport, fastSetImmediateShim);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const workerPath = process.argv[2] ?? ".open-next/server-functions/default/handler.mjs";
  const worker = fs.readFileSync(workerPath, "utf8");

  const hasPatchTarget = [
    consoleFileHook,
    consoleDimHook,
    consoleDimImport,
    nodeCryptoHook,
    fastSetImmediateImport,
  ].some((hook) => worker.includes(hook));

  if (!hasPatchTarget) {
    throw new Error(`Expected ${workerPath} to contain a Next Node-only hook.`);
  }

  fs.writeFileSync(workerPath, stripNextDevConsoleFileImport(worker));
}
