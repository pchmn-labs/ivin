# ivin

A desktop app to run and supervise coding agents (Claude Code, Codex, ACP agents), built so that your agents can change it: through files and a CLI for anything declarative, and through TypeScript plugins for anything else.

## Status

Work in progress, version 0.x: the app runs from source, with Claude Code as its only harness. Releases are published by hand as unsigned macOS zips. The design is in [docs/architecture/](docs/architecture/README.md), and the plugin API may change without notice until 1.0.

## What it is

- **Electron, React and TypeScript**, with a server process written with Effect.
- **Everything is a plugin**, the built-in features included: a plugin is a folder with a `package.json`, and a `server.ts` and a `ui.tsx` under `src/`. A user's UI half is compiled on load.
- **Files and a CLI first**: settings, themes and keybindings live in watched files, session annotations in the app's database, and every `ivin` command is something the UI can do too.
- **A broken plugin does not take the app down**: the design gives plugins their own process and a safe mode; the plugin host that does it is not built yet ([Error isolation](docs/architecture/README.md#error-isolation)).

## Run it

Needs Node 22.18 or later and pnpm (the version is pinned by `packageManager` in `package.json`).

```sh
pnpm install
pnpm dev        # builds the server and the CLI, then starts the UI and the desktop app
pnpm test       # runs the tests; pass paths to run only some
pnpm check      # lint, format and type-check; the CI also runs the tests
```

Before writing code, read [AGENTS.md](AGENTS.md) and [docs/conventions/](docs/conventions/README.md).

## Why

ivin replaces a fork of MonoCode in which every feature was shaped by the cost of the next upstream merge. It starts from what that fork taught about the extension points a real feature set needs.

ivin owes much of its design to [T3 Code](https://github.com/pingdotgg/t3code) (server process, Effect stack, provider layer…) and [MonoCode](https://github.com/hardbeat920/monocode) (features, agents running in worktrees…).

## Licence

[MIT](LICENSE). Third-party material is listed in [NOTICE](NOTICE).
