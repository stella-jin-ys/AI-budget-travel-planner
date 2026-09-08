import { describe, expect, it } from "vitest";
import { stripNextDevConsoleFileImport } from "../scripts/patch-cloudflare-worker.mjs";

describe("Cloudflare worker production patch", () => {
  it("removes Next's Node-only console file hook", () => {
    const worker = "require_node_environment();require_console_file();require_console_exit();";

    expect(stripNextDevConsoleFileImport(worker)).toBe(
      "require_node_environment();/* Removed Next dev console file hook for Cloudflare Workers. */require_console_exit();",
    );
  });

  it("is idempotent", () => {
    const worker = "require_console_file();";

    expect(stripNextDevConsoleFileImport(stripNextDevConsoleFileImport(worker))).toBe(
      "/* Removed Next dev console file hook for Cloudflare Workers. */",
    );
  });
});
