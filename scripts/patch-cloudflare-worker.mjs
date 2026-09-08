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
const fsRequire = 'require("fs")';
const pathRequire = 'require("path")';
const nodePathRequire = 'require("node:path")';
const osRequire = 'require("os")';
const urlRequire = 'require("url")';
const cryptoRequire = 'require("crypto")';
const vmRequire = 'require("vm")';
const streamRequire = 'require("stream")';
const streamWebRequire = 'require("node:stream/web")';
const httpRequire = 'require("http")';
const httpsRequire = 'require("https")';
const cloudflareFs = "__cloudflareFs";
const cloudflarePath = "__cloudflarePath";
const cloudflareOs = "__cloudflareOs";
const cloudflareUrl = "__cloudflareUrl";
const cloudflareCrypto = "__cloudflareCrypto";
const cloudflareVm = "__cloudflareVm";
const cloudflareStream = "__cloudflareStream";
const cloudflareStreamWeb = "__cloudflareStreamWeb";
const cloudflareHttp = "__cloudflareHttp";
const cloudflareHttps = "__cloudflareHttps";
const cloudflareNodeImports =
  'import * as __cloudflarePath from "node:path";\nimport * as __cloudflareUrl from "node:url";\nimport * as __cloudflareCrypto from "node:crypto";\nimport * as __cloudflareStream from "node:stream";\nconst __cloudflareFs = { existsSync: () => false, readFileSync: () => "", mkdirSync: () => {}, writeFileSync: () => {}, promises: { readFile: async () => "", writeFile: async () => {}, mkdir: async () => {}, stat: async () => ({}) } };\nconst __cloudflareOs = { cpus: () => [{}] };\nconst __cloudflareVm = {};\nconst __cloudflareStreamWeb = { ReadableStream };\nconst __cloudflareHttp = { Agent: class {} };\nconst __cloudflareHttps = { Agent: class {} };\n';

export function stripNextDevConsoleFileImport(worker) {
  let patched = worker
    .replace(consoleFileHook, replacement)
    .replace(consoleDimHook, consoleDimReplacement)
    .replace(consoleDimImport, consoleDimShim)
    .replace(nodeCryptoHook, nodeCryptoReplacement)
    .replace(fastSetImmediateImport, fastSetImmediateReplacement)
    .replace(fastSetImmediateImport, fastSetImmediateShim);

  if (
    patched.includes(fsRequire) ||
    patched.includes(pathRequire) ||
    patched.includes(nodePathRequire) ||
    patched.includes(osRequire) ||
    patched.includes(urlRequire) ||
    patched.includes(cryptoRequire) ||
    patched.includes(vmRequire) ||
    patched.includes(streamRequire) ||
    patched.includes(streamWebRequire) ||
    patched.includes(httpRequire) ||
    patched.includes(httpsRequire)
  ) {
    patched = patched
      .replaceAll(fsRequire, cloudflareFs)
      .replaceAll(pathRequire, cloudflarePath)
      .replaceAll(nodePathRequire, cloudflarePath)
      .replaceAll(osRequire, cloudflareOs)
      .replaceAll(urlRequire, cloudflareUrl)
      .replaceAll(cryptoRequire, cloudflareCrypto)
      .replaceAll(vmRequire, cloudflareVm)
      .replaceAll(streamRequire, cloudflareStream)
      .replaceAll(streamWebRequire, cloudflareStreamWeb)
      .replaceAll(httpRequire, cloudflareHttp)
      .replaceAll(httpsRequire, cloudflareHttps);

    if (!patched.startsWith(cloudflareNodeImports)) {
      patched = `${cloudflareNodeImports}${patched}`;
    }
  }

  return patched;
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
    fsRequire,
    pathRequire,
    nodePathRequire,
    osRequire,
    urlRequire,
    cryptoRequire,
    vmRequire,
    streamRequire,
    streamWebRequire,
    httpRequire,
    httpsRequire,
  ].some((hook) => worker.includes(hook));

  if (!hasPatchTarget) {
    throw new Error(`Expected ${workerPath} to contain a Next Node-only hook.`);
  }

  fs.writeFileSync(workerPath, stripNextDevConsoleFileImport(worker));
}
