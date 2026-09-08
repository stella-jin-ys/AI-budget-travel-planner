import { describe, expect, it } from "vitest";
import { stripNextDevConsoleFileImport } from "../scripts/patch-cloudflare-worker.mjs";

describe("Cloudflare worker production patch", () => {
  it("removes Next's Node-only console file hook", () => {
    const worker = "require_node_environment();require_console_file();require_console_exit();";

    expect(stripNextDevConsoleFileImport(worker)).toBe(
      "require_node_environment();/* Removed Next dev console hook for Cloudflare Workers. */require_console_exit();",
    );
  });

  it("removes the Node-only console dimmer bootstrap", () => {
    const worker = "require_console_dim_external();var dim=require_console_dim_external();";

    expect(stripNextDevConsoleFileImport(worker)).toBe(
      "/* Removed Next dev console dim hook for Cloudflare Workers. */var dim=({ setAbortedLogsStyle() {} });",
    );
  });

  it("removes Next's Node crypto patch bootstrap", () => {
    expect(stripNextDevConsoleFileImport("require_node_crypto();")).toBe(
      "/* Removed Next Node crypto patch for Cloudflare Workers. */",
    );
  });

  it("removes Next's Node require hook bootstrap", () => {
    expect(stripNextDevConsoleFileImport("require_require_hook()")).toBe(
      "void 0 /* Removed Next Node require hook for Cloudflare Workers. */",
    );
  });

  it("shims the fast setImmediate export without loading Node timers", () => {
    const worker = "require_fast_set_immediate_external()}});let timers=require_fast_set_immediate_external();";

    expect(stripNextDevConsoleFileImport(worker)).toBe(
      "/* Removed Next fast setImmediate patch for Cloudflare Workers. */}});let timers=({ unpatchedSetImmediate: (callback) => setTimeout(callback, 0) });;",
    );
  });

  it("uses the stream compatibility shim for webpack external modules", () => {
    expect(stripNextDevConsoleFileImport('e2.exports=require("node:stream")')).toContain(
      "e2.exports=__cloudflareStreamCompat",
    );
  });

  it("rewrites raw Node fs and path imports for the Worker runtime", () => {
    const worker = 'var fs=require("fs"),path=require("path"),nodePath=require("node:path"),os=require("os"),url=require("url"),crypto=require("crypto"),vm=require("vm"),stream=require("stream"),streamWeb=require("node:stream/web"),http=require("http"),https=require("https");';

    const patched = stripNextDevConsoleFileImport(worker);

    expect(patched).toContain('const __cloudflareStreamWeb = { ReadableStream };');
    expect(patched).toContain('const require = __cloudflareNodeRequire;');
    expect(patched).toContain(
      'var fs=__cloudflareFs,path=__cloudflarePath,nodePath=__cloudflarePath,os=__cloudflareOs,url=__cloudflareUrl,crypto=__cloudflareCrypto,vm=__cloudflareVm,stream=__cloudflareStream,streamWeb=__cloudflareStreamWeb,http=__cloudflareHttp,https=__cloudflareHttps;',
    );
  });

  it("is idempotent", () => {
    const worker = "require_console_file();";

    expect(stripNextDevConsoleFileImport(stripNextDevConsoleFileImport(worker))).toBe(
      "/* Removed Next dev console hook for Cloudflare Workers. */",
    );
  });
});
