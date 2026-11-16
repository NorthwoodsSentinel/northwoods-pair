# Provenance (NOR-381, the Cliff factory refactor)

- **Method and rules**: `modelcontextprotocol/inspector` (public), branch `v2/main`, commit `d330df9617e44ec893bc1a53618662239342d433`: its `AGENTS.md`, `docs/quality-gate.md`, `eslint.config.js`, `.github/workflows/main.yml` and `.github/workflows/dco.yml`, applied with the owner's rulings (90 per file on all four coverage measures, no lint warning tier, signed-off commits, SHA-pinned actions). Where the Inspector's way and ours differ, its way is the default.
- **Copied unchanged except one provenance paragraph each**: `scripts/dco-check.mjs`, `scripts/dco-check.test.mjs`, `scripts/lib/main-module.mjs`, `scripts/lib/main-module.test.mjs`.
- **Copied, then edited**: `.github/workflows/dco.yml` (no `v2/**` filter, `main` as the one branch, actions pinned to SHAs; the edits are listed in the file).
- **Written for this repo in the Inspector's shape**: `AGENTS.md` (the rules that apply to this repo), `CLAUDE.md` (`@./AGENTS.md`, as the Inspector's), `eslint.config.js`, `vitest.config.ts`, `.prettierignore`, `.github/workflows/main.yml`, `package.json` scripts (`format`, `lint`, `typecheck`, `test`, `validate`, `local:dco`, `local:gate`).
- **License note**: the Inspector's `LICENSE` states the MCP project is moving from MIT to Apache-2.0 (code under either; documentation under CC-BY-4.0). Attribution to the Model Context Protocol project and its contributors is kept in the copied files' own headers.
- **Ticket**: NOR-381. **Date**: 2026-11-16.
