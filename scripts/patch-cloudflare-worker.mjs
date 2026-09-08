import fs from "node:fs";
import { fileURLToPath } from "node:url";

const consoleFileHook = "require_console_file();";
const consoleDimHook = "require_console_dim_external();";
const consoleDimImport = "require_console_dim_external()";
const nodeCryptoHook = "require_node_crypto();";
const nodeRequireHook = "require_require_hook()";
const fastSetImmediateImport = "require_fast_set_immediate_external()";
const replacement = "/* Removed Next dev console hook for Cloudflare Workers. */";
const consoleDimReplacement = "/* Removed Next dev console dim hook for Cloudflare Workers. */";
const consoleDimShim = "({ setAbortedLogsStyle() {} })";
const nodeCryptoReplacement = "/* Removed Next Node crypto patch for Cloudflare Workers. */";
const nodeRequireHookReplacement = "void 0 /* Removed Next Node require hook for Cloudflare Workers. */";
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
const streamExternalRequire = 'e2.exports=require("node:stream")';
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
  `import * as __cloudflarePath from "node:path";
import * as __cloudflareUrl from "node:url";
import * as __cloudflareCrypto from "node:crypto";
import * as __cloudflareStream from "node:stream";
const __cloudflareFs = { existsSync: () => false, readFileSync: () => "", mkdirSync: () => {}, writeFileSync: () => {}, promises: { readFile: async () => "", writeFile: async () => {}, mkdir: async () => {}, stat: async () => ({}) } };
const __cloudflareOs = { cpus: () => [{}] };
const __cloudflareVm = {};
const __cloudflareStreamWeb = { ReadableStream };
const __cloudflareStreamCompat = { ...__cloudflareStream, isUtf8: () => true };
const __cloudflareAsyncHooks = { AsyncLocalStorage: class { run(_store, callback, ...args) { return callback(...args); } getStore() {} enterWith() {} disable() {} static bind(callback) { return callback; } } };
const __cloudflareUtil = { format: (...args) => args.map(String).join(" "), inspect: String, promisify: (callback) => callback, types: {}, debuglog: () => () => {}, TextEncoder, TextDecoder };
const __cloudflareTimers = { setImmediate: (callback, ...args) => setTimeout(callback, 0, ...args), clearImmediate: clearTimeout };
const __cloudflareTimersPromises = { setImmediate: () => Promise.resolve() };
const __cloudflareBuffer = { Buffer: globalThis.Buffer, isUtf8: () => true, isAscii: () => true };
const __cloudflareHttp = { Agent: class {} };
const __cloudflareHttps = { Agent: class {} };
const __cloudflareNodeRequire = (id) => ({ "async_hooks": __cloudflareAsyncHooks, "node:async_hooks": __cloudflareAsyncHooks, "buffer": __cloudflareBuffer, "node:buffer": __cloudflareBuffer, "crypto": __cloudflareCrypto, "node:crypto": __cloudflareCrypto, "fs": __cloudflareFs, "node:fs": __cloudflareFs, "fs/promises": __cloudflareFs.promises, "node:fs/promises": __cloudflareFs.promises, "http": __cloudflareHttp, "node:http": __cloudflareHttp, "https": __cloudflareHttps, "node:https": __cloudflareHttps, "module": {}, "node:module": {}, "net": {}, "node:net": {}, "os": __cloudflareOs, "node:os": __cloudflareOs, "path": __cloudflarePath, "node:path": __cloudflarePath, "stream": __cloudflareStreamCompat, "node:stream": __cloudflareStreamCompat, "node:stream/web": __cloudflareStreamWeb, "stream/web": __cloudflareStreamWeb, "timers": __cloudflareTimers, "node:timers": __cloudflareTimers, "timers/promises": __cloudflareTimersPromises, "node:timers/promises": __cloudflareTimersPromises, "tls": {}, "node:tls": {}, "tty": {}, "node:tty": {}, "url": __cloudflareUrl, "node:url": __cloudflareUrl, "util": __cloudflareUtil, "node:util": __cloudflareUtil, "vm": __cloudflareVm, "node:vm": __cloudflareVm, "zlib": {}, "node:zlib": {} }[id] ?? {});
const require = __cloudflareNodeRequire;
`;

export function stripNextDevConsoleFileImport(worker) {
  let patched = worker
    .replace(consoleFileHook, replacement)
    .replace(consoleDimHook, consoleDimReplacement)
    .replace(consoleDimImport, consoleDimShim)
    .replace(nodeCryptoHook, nodeCryptoReplacement)
    .replace(nodeRequireHook, nodeRequireHookReplacement)
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
    patched.includes(streamExternalRequire) ||
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
      .replaceAll(streamExternalRequire, "e2.exports=__cloudflareStreamCompat")
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
    nodeRequireHook,
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
    streamExternalRequire,
    streamExternalRequire,
    httpRequire,
    httpsRequire,
  ].some((hook) => worker.includes(hook));

  if (!hasPatchTarget) {
    throw new Error(`Expected ${workerPath} to contain a Next Node-only hook.`);
  }

  fs.writeFileSync(workerPath, stripNextDevConsoleFileImport(worker));
}
