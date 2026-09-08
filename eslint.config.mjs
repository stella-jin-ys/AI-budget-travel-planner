import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    ".open-next/**",
    "dist/**",
    "build/**",
    "next-env.d.ts",
    // Ignore generated artifacts left by the pre-root local checkout.
    "travel-planner/**",
  ]),
]);

export default eslintConfig;
