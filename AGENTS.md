# northwoods-pair

northwoods-pair is a forkable Cloudflare Worker template in JavaScript (`worker.js`): a thinking pair grounded in its deployer's own writing, using KV for state, R2 for uploaded writing, Vectorize for retrieval and Workers AI for embeddings and chat. Each fork runs on its deployer's own account; `wrangler.toml` is a template with placeholders. There is no published package. The owner picks what gets worked on; agents carry it through to merge.

**This file holds the _rules_: the conventions a reviewer cites against a diff.** It is loaded in full on every turn, so it stays resident and must stay complete enough to work from on its own.

**The repo's _procedures_ — multi-step recipes with commands and live IDs — live in `.claude/skills/`.** They are ordinary committed Markdown, so any agent or human can read one directly. [No skills yet in this repo.]

Where this file came from is in [`PROVENANCE.md`](./PROVENANCE.md).

## Development setup

- **Use the Inspector's runner (`npx`, its `npm run` scripts) when running its tools or its procedures.** Where its way and ours differ, its way is the default; a departure needs a stated reason.
- **This repo installs its dev tooling with npm** from `package-lock.json` (`npm ci`). It declares no `wrangler`; deploying a fork is its owner's act (see [Cloudflare work](#cloudflare-work-ours)).
- **`worker.js` is JavaScript**, the Worker as published: it is linted (`js.configs.recommended`) and tested by `test/worker.test.ts` with fake bindings, not typechecked.

## Dependency placement

- **Pin a transitive dependency with an `overrides` entry**, not with `npm audit fix` — which "resolves" an advisory with no upward escape by silently downgrading.

### Dependency updates are issue-driven, like everything else

**Dependabot opens no pull requests against this repo — neither version updates nor security updates.** A Dependabot PR carries no ticket, so it would be the one standing exception to [Issue-driven Work Style](#issue-driven-work-style). Both halves are to be replaced by scheduled workflows that file **issues**, and the fix is written by hand. [No sweeps yet in this repo.]

- **Dependabot _alerts_ stay on.** Alerts and security-update PRs are independent settings; only the PRs are off.
- **Actions are pinned to a commit SHA with an exact `# vX.Y.Z` comment, in every job of this repo.** A tag is mutable, so whoever can move it replaces the code running in the job. Resolve the SHA and the exact release from the **same** tag lookup when bumping.

## Contributing

**The owner picks the work; an agent carries it through to merge.** This repo is public, so **only the owner merges**: an agent opens the pull request, runs the checks and the review, and leaves it open.

**Every PR must reference an issue. No exceptions, regardless of who opens it.** The PR body's first line is `Closes NOR-<NUMBER>` (or `Refs NOR-<NUMBER>` for one step of a larger ticket). If there's no issue yet, create the issue first.

## Project Status and Direction

- **Develop branch**: `main` (the repo's default branch). Every PR targets it. Cut feature branches from it.
- **Repo**: `NorthwoodsSentinel/northwoods-pair` (public)
- **Issue tracker**: Linear, team key `NOR`

## Maintenance Rules

- When adding, removing, renaming, or changing the purpose of any file or folder, update the README.
- When rules for implementation and testing change, update this file and `PROVENANCE.md`.
- **When a _procedure_ changes, update the skill that owns it — not this file.** Two copies of a command sequence is strictly worse than one, because the stale copy is indistinguishable from the live one.
- **Every new file carries a header comment explaining its own purpose and the reasoning behind it.** This applies to new files and to files a change touches; there is no bulk migration of existing files. `CLAUDE.md` is the exception: it holds only the import `@./AGENTS.md`, as the source's does, so this file loads in full. JSON files, which cannot hold a comment (`package.json`, `package-lock.json`), are the other exception.
- **Existing code that a change only reformats (`npm run format`) is not "touched"** for this rule or for the double-cast rule below; they apply to lines edited by hand.

## Issue-driven Work Style

All work is driven by tickets in Linear (team key `NOR`).

- **Before starting work, check Linear for the relevant ticket.** Every item of work is a real Linear issue; **never create a duplicate**.
  - **The one exception is a privately reported vulnerability**, tracked privately until the reviewed fix is ready. **Accepting and publishing an advisory are outward-facing and stay human-gated.**
- **Only issues are tickets — never PRs.**
- **Label by type — exactly one of `bug` / `enhancement` / `documentation` / `chore` / `question`** on every issue you create.
- **`Backlog` ⇔ filed, not approved; `Todo` ⇔ approved by the owner.** **An agent starts work only on a ticket that is in `Todo`.**
- **`Done` means the work shipped.** Anything else — duplicate, won't fix, obsolete — is `Canceled` or `Duplicate`, never `Done`.
- **When work begins**, create the feature branch **in a new git worktree** or a fresh clone — never by switching branches in a checkout another session shares.
- **When work is complete**, run `npm run format` then `npm run local:gate`, **sign off every commit** (`git commit -s`; `.github/workflows/dco.yml`, job `DCO`, fails a PR on any unsigned commit), and open a PR against `main`.
- **After opening a PR, run a Codex review loop to exhaustion — unprompted.** Codex runs read-only through the `codex-review` wrapper. Stop on the **first** clean round (no confirming round "just to be sure"). **Weigh each finding against the issue the PR closes and decline scope expansion.**
- **If new tasks are discovered during development, create issues** in Linear.
- **Pace bulk GitHub writes: 1 s between requests, never in parallel.**

## Always test new or modified code

- **Ensure all code has corresponding tests.** The bar is the source's: **≥ 90 on all four dimensions — lines, statements, functions, and branches — per file**, and **CI enforces it** (`npm run test`, Vitest with V8 coverage, `vitest.config.ts`). The threshold is never lowered. The copied guard scripts under `scripts/` are tested with `node --test` and held to 90 on lines, branches and functions per file by node's own coverage (`npm run test:scripts`); node reports no statement figure.
- **A genuinely-unreachable branch is annotated at the source, never waved through by lowering the gate.**
- **In unit tests that expect error output, suppress it from the console.**
- **Keep a test file's exact filename.** `vitest.config.ts` names each test file by path in `TEST_FILES` and fails on a listed file that is missing or a test file that is not listed, so a renamed file fails instead of being skipped (Vitest alone would skip it while other files match).
- **A coverage `include` is a whitelist.** Place new modules inside it.
- **A test that races is fixed with fake timers or an awaited condition, never with headroom.** `retry` stays unset. Every CI job declares `timeout-minutes`.

## Mandatory pre-push gate

`validate` runs the format check, lint, the typecheck, the guard scripts' tests (`test:scripts`) and the tests with per-file coverage (`test`). `local:gate` is `validate` then the local-only sign-off stage `local:dco`. CI runs `validate`; the pull request's commits are checked by the `DCO` workflow.

- **ALWAYS run `npm run format` before committing.** Its scope is source code (the JavaScript and TypeScript extensions), as in the Inspector's own `format` scripts; JSON, YAML, Markdown and shell files are not reformatted.
- **`npm run local:gate` is the mandatory pre-push command.** It runs **every check** CI runs, plus one local-only step.
- **`npm run validate` is the fast inner-loop check and is NOT an acceptable substitute.**

## Waiting on long-running work

**When you are waiting for something to finish, arm a notifier and stop. Never spend turns polling.** State the harness cannot observe (a CI run, a review queue) is polled **inside a single backgrounded loop that exits when the condition holds**. **If a notifier is already armed, that settles it — wait.**

## Build output is never a gate target

**No gate — lint, format, or typecheck — may read generated output.** Each scope states this in its own ignore list. **Never widen an ignore to silence a finding in first-party code.**

## Lint has no warning tier

**Every `lint` script runs with `--max-warnings 0`, so a warning fails `validate` exactly as an error does.**

- **Do not silence a finding to satisfy the gate.** If a rule genuinely must be waived on a line, use its inline disable comment **with a one-line justification**.

## Typescript instructions

- Use TypeScript for all new code. **Recorded exception:** the copied guard scripts under `scripts/` are JavaScript (`.mjs`), as in the source; they are linted (`js.configs.recommended`) and tested, not typechecked. Also: `worker.js`, the published Worker, stays JavaScript.
- NEVER use 'any' as a type.
- NEVER suppress error types in the typescript or eslint configuration as a way of satisfying the linter or compiler.
- AVOID double casts (`as unknown as T`); one that is genuinely unavoidable carries an inline comment saying why it is safe.
- **NEVER leave a promise floating.** Every promise is awaited, returned, ended with `.catch(…)`, or discarded with `void` and a one-line reason.

## Cloudflare work (OURS)

**OURS: this section does not come from the Inspector.** It covers the Worker this repo holds.

- **Deploying a Worker is the release, and it is the owner's act.** Every `wrangler deploy` counts, whatever script wraps it. Nothing in this repo deploys from CI.
- **Worker secrets, bindings, vars and routes are handled by name only, and their values never pass through a chat.** The owner sets them, never in a committed file.
- **Check Cloudflare's current documentation before writing Cloudflare code**, and cite the page and the date it was read.
- **Local-runtime and deployed results are separate results, and each record names its target.** The tests here run in-process under Node with a mocked environment; they say nothing about the deployed Worker.

## Only the owner does

- Picking new work.
- Spending.
- Secrets.
- Repository settings, including rulesets.
- Deploying anything.
- Anything public or sent to other people.
