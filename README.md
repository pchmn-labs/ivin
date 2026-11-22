# ivin

A desktop app to run and supervise coding agents (Claude Code, Codex, ACP agents), built so that your agents can change it: through files and a CLI for anything declarative, and through TypeScript plugins for anything else.

## Status

Design phase: there is no code to run yet. The design is in [docs/architecture.md](docs/architecture.md).

## What it will be

- **Electron, React and TypeScript**, with a server process written with Effect.
- **Everything is a plugin**, the built-in features included: a plugin is a folder with a `package.json`, and a `server.ts` and a `ui.tsx` under `src/`, compiled on load and reloaded on change.
- **Files and a CLI first**: settings, themes and keybindings live in watched files, session annotations in the app's database, and every `ivin` command is something the UI can do too.
- **A broken plugin does not take the app down**: plugins run in their own process, and a safe mode starts the app without them.

## Why

ivin replaces a fork of MonoCode in which every feature was shaped by the cost of the next upstream merge. It starts from what that fork taught about the extension points a real feature set needs.
