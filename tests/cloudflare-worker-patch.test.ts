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

  it("shims the fast setImmediate export without loading Node timers", () => {
    const worker = "require_fast_set_immediate_external()}});let timers=require_fast_set_immediate_external();";

    expect(stripNextDevConsoleFileImport(worker)).toBe(
      "/* Removed Next fast setImmediate patch for Cloudflare Workers. */}});let timers=({ unpatchedSetImmediate: (callback) => setTimeout(callback, 0) });;",
    );
  });

  it("rewrites raw Node fs and path imports for the Worker runtime", () => {
    const worker = 'var fs=require("fs"),path=require("path"),os=require("os");';

    expect(stripNextDevConsoleFileImport(worker)).toBe(
      'import * as __cloudflarePath from "node:path";\nconst __cloudflareFs = { existsSync: () => false, readFileSync: () => "", mkdirSync: () => {}, writeFileSync: () => {}, promises: { readFile: async () => "", writeFile: async () => {}, mkdir: async () => {}, stat: async () => ({}) } };\nconst __cloudflareOs = { cpus: () => [{}] };\nvar fs=__cloudflareFs,path=__cloudflarePath,os=__cloudflareOs;',
    );
  });

  it("is idempotent", () => {
    const worker = "require_console_file();";

    expect(stripNextDevConsoleFileImport(stripNextDevConsoleFileImport(worker))).toBe(
      "/* Removed Next dev console hook for Cloudflare Workers. */",
    );
  });
});
