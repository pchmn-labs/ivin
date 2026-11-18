# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A developer who runs several coding agents (Claude Code first, later Codex and ACP agents) at once, all day, across several projects and git worktrees. The author is the first user and sets the bar; the app will be published for other developers later, but first-run onboarding for strangers is not a goal yet.

## Product Purpose

ivin is a desktop app to run and supervise coding agents. It replaces a fork of MonoCode. Success is that it becomes the daily driver: the user sees at a glance which sessions are working, which wait for an answer, and on which branch, and answers them without hunting.

## Positioning

ivin is built so that the user's agents can change it. Everything is a plugin, the built-in features included; settings, themes and keybindings are watched files reachable through the `ivin` CLI. A plugin written by an agent must look native, so the design system is part of the public plugin API.

## Operating Context

- ivin is the user's main, full-screen tool. It hosts the editor and the terminal too (they arrive in later milestones), so the user stays in it for hours.
- Several projects are open at once; each has its own tab bar, one session per tab (milestone 2).
- Desktop only: Electron on macOS first, Linux too.

## Capabilities and Constraints

- Milestone 1 ships: project picker, session list, transcript (streamed Markdown answers, thinking, tool calls), composer with a model choice, tool approvals, interrupt and status.
- Themes are files (`themes/<id>.json`: colours plus CSS), so every colour the UI uses must be a token a theme can override.
- Plugins import only `@ivin/plugin-api` and `react`; the host supplies the design system components to them.
- Transcript rows render inside a virtualised list and must stay cheap.
- Domain terms live in `GLOSSARY.md`; the design of record is `docs/architecture.md`.

## Brand Commitments

- The name comes from the yew ("if" in French). The app icon (`apps/desktop/build/`) shows a yew sprig leaning right, then a red terminal cursor, on a dark green background.
- The icon is binding: the default theme, named "forest", takes its colours (dark green, yew green, the cursor's red), in a dark and a light variant.
- Standing preference: the category's familiar layout and conventions, at the craft level of Linear, Zed, Raycast and Cursor / Claude desktop. Linear's finish, not its density: fewer facts on screen, simple.

## Evidence on Hand

- The app icon. No screenshots, testimonials or marketing material exist; none may be invented.

## Product Principles

1. State before decoration: which agent works, waits or failed must read at a glance.
2. Plugins are first-class: a built-in feature uses the same components and tokens a third-party plugin gets.
3. Everything themable: no colour or font outside the tokens.
4. Built for hours of use in one window: calm, dense, keyboard-first.
