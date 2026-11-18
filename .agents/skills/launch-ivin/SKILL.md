---
name: launch-ivin
description: Launch ivin to show it to the user or to screenshot it yourself. Use when running or screenshotting ivin, checking a change in the real app, or showing a UI change in a pull request.
---

# Launch ivin

## The user sees it

Run `pnpm dev` in the background, then tell the user the app is up so they switch to it themselves.

To try a session by hand, open `ivin-playground`, a folder beside the main checkout, as the project (`git init` it when missing). A session runs a real agent in its project folder, leaving its files and its Claude Code history there, so the playground keeps them out of the ivin repo.

## You see it

Run `pnpm --filter @ivin/desktop shot` (about 10 s). It plays a scenario ending on a tool call waiting for approval, and prints the path of one window-only PNG per step in `apps/desktop/shots/`.

Read one PNG at a time: each is a full-resolution capture, and several at once overflow the context.

To see another state, add a step to `apps/desktop/scripts/shot.ts`; the helpers of `apps/desktop/e2e/` drive the window.

## In a pull request

The template's Screenshots section says when a pull request needs one. Pick the one or two `shot` PNGs of the branch that show the change, then run `.agents/skills/launch-ivin/pr-shots.sh <png>...` from the branch. It pushes them to `pr-screenshots`, a branch that holds only screenshots and is never merged, and prints the Markdown to paste into the body. When no step of `shot` shows the change, delete the section rather than add a step for it.

## Other tools

Only `shot` captures the window: `screencapture` shows the wallpaper and `osascript` fails, because the terminal has neither the Screen Recording nor the Accessibility permission. `pnpm package` takes minutes and belongs to the e2e tests.
