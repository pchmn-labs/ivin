# AGENTS.md

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on `pchmn-labs/ivin`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

A change with no decision to record and no work to defer, that fits in one commit, skips the ticket and goes straight to a PR. Anything else gets its ticket first.

### Triage labels

The default vocabulary: `needs-triage`, `ready-for-agent`, `wontfix`, `bug`, `enhancement`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` for the domain's terms and `docs/adr/` for its decisions, at the repo root. `docs/agents/domain.md` says what to do when a change runs into an ADR.

### Design of record

`docs/architecture/` is the design the code follows: one file per module of its Domain model, and `README.md` for the rest. `DESIGN.md` is the design the UI follows. A change that departs from one updates it in the same PR; in `docs/architecture/`, it updates the file of the module it touches.

### Conventions

`docs/conventions/` holds how code is written: `README.md` for every package, and one file for each of `apps/server`, `packages/harness`, `packages/ui` and `plugins`.

`docs/finished-features.md` lists what a feature the user sees is often missing.

### Launching ivin

To run ivin, show it to the user, capture its screens or show a UI change in a pull request, use the `launch-ivin` skill: its `shot` command is the way to capture them, for example to compare a change with its prototype.

### Running scripts and tools

Run a tool through the root `package.json` script that wraps it, because the script carries the config. With no script for what you need, call Vite+ through `pnpm vp <command>`, and any other tool through `pnpm exec <tool>`, never `npx`.

While building, run the test files you touch: `pnpm test <path>…`. You choose which other tests to run: the tests of a module whose behaviour you changed, or the whole suite (`pnpm test`) when a change reaches many modules. The pull request's CI runs every test the branch's changes reach. Run `pnpm check` (lint, format, types) before the commit. After an edit that changes no code, only words in docs or a test's name, run `pnpm lint` and `pnpm format:check` instead. Run `pnpm e2e` locally only when the change touches the desktop app or the app's startup. Leave `pnpm package` to CI. `pnpm install-app` packages ivin and replaces `/Applications/ivin.app`: run it only when the user asks.

### Grilling

Ask each round of a grilling session (`grilling`, `grill-with-docs`) through the `interactive-form` skill rather than in the chat, unless the user asks for the terminal.

### Writing

Write tickets, pull requests, ADRs, docs and questions in plain words. A title names the concrete thing and what changes about it, so a reader who has never seen the project understands it without opening it. Use the glossary's terms and ordinary words: no metaphors, no terms of your own. Say each thing once.

### Branching

One branch per ticket, cut from `origin/main`: `<type>/<issue-number>-<slug>`, where `<type>` is the conventional-commit type of the work and `<slug>` is the kebab-cased ticket title. A ticketless change takes `<type>/<slug>`. Implementation commits land on that branch, never directly on `main`.

Start every branch in its own git worktree under `.worktrees/`, named after the branch, never by switching branches in the main checkout: another session may be working there. Cut it from a fresh `origin/main`, because a local `main` lags behind the PRs merged since; only work that builds on another branch starts from that branch.

### Pull requests

One PR per ticket or ticketless change, opened against `main`. Its title is a conventional commit, `<type>(<scope>): <subject>`, because a squash merge takes the title. Its body follows `.github/pull_request_template.md` when the repo has one.

The end-to-end tests of the packaged app run on a pull request only when it has a label; without one, they run after the merge, on `main`. Give the PR:

- `e2e:linux` when the change can break what only the packaged app shows: the desktop app's main process or preload, the server's startup or its processes, the harness's processes, packaging, a native dependency, the CLI, or a test in `apps/desktop/e2e/`.
- `e2e:macos` when the change can behave differently on macOS: code that checks the platform, the desktop app's main process or preload, packaging, a native dependency, keyboard handling.

Before opening the PR, run the `code-review` skill on the branch since its merge-base with `main`, and fix what it finds or say in the PR why you left it.

Everything written to the tracker is in English, whatever the language of the conversation: a ticket, a PR title, a PR body, a comment. The code, the commits and the docs are too.

### Design

`/prototype` is the user's global skill, launched by the user. An old prototype is read from git history, never as a spec: `DESIGN.md` and the app are the only design sources.

Motion goes through the `animate` and `choreograph` skills, not `impeccable animate`. A new UI dependency goes through `pick-ui-library` first.

### Code comments

Write them in English, on the exact line they protect: one line by default, two only if each carries a fact of its own. A comment states something the code cannot (a constraint, a gotcha, a why), never a paraphrase of the line below it, never a receipt for a decision explained elsewhere. Design rationale belongs in `docs/adr/`, and nothing already written there, in `GLOSSARY.md`, in the schema or in a test name is repeated in a comment. When in doubt, delete.

In declarative config (YAML, JSON, TOML) the default is none. Only a cross-file coupling, a parameter deliberately left out, or an operational dependency the file cannot show earns one.
