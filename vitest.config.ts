// Vitest configuration for northwoods-pair (NOR-381): which tests run, and the
// per-file coverage bar.
//
// Vitest and its V8 coverage provider are the MCP Inspector's test tools at
// its exact pins (4.1.12; modelcontextprotocol/inspector at d330df96).
//
// The thresholds block is the Inspector's own
// (clients/launcher/vitest.config.ts:29-35 at d330df96): 90 on all four
// dimensions, per file. It is never lowered.
//
// `test.include` names each test file by path, not by a glob: a renamed test
// file then fails the run instead of being skipped (AGENTS.md: keep a test
// file's exact filename).
//
// `coverage.include` is the whole tree over the source extensions, so a new
// file anywhere is measured without anyone remembering to add it. A file no
// test loads is reported at 0 and fails. Every exclusion of first-party code
// below is one exact path with its reason and its follow-up ticket; never a
// glob.
//
// `testTimeout` is stated once, here (AGENTS.md: budgets are chosen values,
// stated once). `retry` stays unset: a retry would turn a real red into a
// quiet green.

import { defineConfig } from "vitest/config";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Every test file, by path. Vitest skips a listed path that does not exist
// as long as another listed file matches, so this config checks both ways
// itself: a listed file that is missing, or a test file on disk (TypeScript or JavaScript)
// that is not listed, fails the run here (Codex review, NOR-381).
const TEST_FILES = ["test/worker.test.ts"];
const ROOT = fileURLToPath(new URL(".", import.meta.url));
for (const t of TEST_FILES) {
  if (!existsSync(ROOT + t)) {
    throw new Error(`vitest config: listed test file is missing: ${t}`);
  }
}
// The copied guards' own tests, run by `node --test` in `npm run test:scripts`
// (each by path); listed so the inventory below knows them.
const GUARD_TEST_FILES = [
  "scripts/dco-check.test.mjs",
  "scripts/lib/main-module.test.mjs",
];
for (const t of GUARD_TEST_FILES) {
  if (!existsSync(ROOT + t)) {
    throw new Error(`vitest config: listed guard test file is missing: ${t}`);
  }
}
// Generated and install output is never read (AGENTS.md: build output is
// never a gate target); the same names as .gitignore.
const GENERATED = ["node_modules", "coverage", "dist", ".wrangler"];
const onDisk = readdirSync(ROOT, { recursive: true, encoding: "utf8" }).filter(
  (f) =>
    /\.(test|spec)\.(ts|mts|cts|tsx|js|mjs|cjs)$/.test(f) &&
    !f.split("/").some((part) => GENERATED.includes(part)),
);
for (const f of onDisk) {
  if (!TEST_FILES.includes(f) && !GUARD_TEST_FILES.includes(f)) {
    throw new Error(`vitest config: test file not listed in TEST_FILES: ${f}`);
  }
}

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: TEST_FILES,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      // `skipFull: false`: list every measured file, including one at 100%.
      reporter: [["text", { skipFull: false }], "json-summary"],
      // The whole tree over every JS and TS extension, so a new file anywhere
      // is measured (and fails at 0) without anyone remembering to add it.
      include: ["**/*.{js,mjs,cjs}", "**/*.{ts,mts,cts,tsx}"],
      exclude: [
        // Test files are not code under test.
        "**/*.test.*",
        "**/*.spec.*",
        // Configuration, not code under test.
        "vitest.config.ts",
        "eslint.config.js",
        // The two copied `.mjs` guards, by exact path: tested under `node --test`
        // and measured per file by node's own coverage at 90 on lines, branches
        // and functions (`npm run test:scripts`; node reports no statement
        // figure). Any other `.mjs` under scripts/ is measured here, so a new
        // script with no test fails this gate.
        "scripts/dco-check.mjs",
        "scripts/lib/main-module.mjs",
        "scripts/**/*.test.mjs",
        // Build and install output.
        "node_modules/**",
        ".wrangler/**",
        "dist/**",
        "coverage/**",
      ],
      thresholds: {
        perFile: true,
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 90,
      },
    },
  },
});
