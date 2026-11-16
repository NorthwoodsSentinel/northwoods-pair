// Lint configuration for northwoods-pair (NOR-381).
//
// The rule set is the MCP Inspector's root config (modelcontextprotocol/
// inspector, eslint.config.js at d330df96), reduced to one scope:
// `js.configs.recommended`,
// `tseslint.configs.recommended`, its `_`-prefix `no-unused-vars` block and
// type-aware `no-floating-promises` at `error`.
//
// `npm run lint` is `eslint . --max-warnings 0`: the whole tree, and a warning
// fails exactly as an error does (AGENTS.md: lint has no warning tier).
//
// The parser is given tsconfig.json. A TypeScript file outside that project
// fails lint with "was not found in any of the provided project(s)".
//
// The copied `.mjs` guards under scripts/ are linted here with the source's
// JavaScript rules (`js.configs.recommended`), a departure from the Inspector,
// which leaves them unlinted: Codex review asked for every
// executable file to be under a gate. They are JavaScript, so there is no
// type-aware lint and no typecheck for them.

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    // Build and install output is never a gate target (AGENTS.md).
    "node_modules/**",
    ".wrangler/**",
    "dist/**",
    "coverage/**",
  ]),
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // An `_`-prefix is the explicit "intentionally unused" marker.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // A floated promise reads like an awaited one minus four characters,
      // and its rejection surfaces somewhere else entirely.
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    // Every JavaScript file in the tree, CommonJS ones first: the same
    // JavaScript rules everywhere, so no .js/.mjs/.cjs file escapes lint.
    files: ["**/*.cjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
]);
