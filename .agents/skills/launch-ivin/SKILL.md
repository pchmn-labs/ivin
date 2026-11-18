---
name: launch-ivin
description: Launch ivin, the Electron app in this repo, to show it to the user or to see it yourself (screenshot). Use when running, starting or screenshotting ivin, or confirming a change works in the real app.
---

# Launch ivin

Two ways, by who needs to see the app.

## The user sees it

Run `pnpm dev` in the background, then tell the user the app is up so they switch to it themselves.

## You see it

Run `pnpm --filter @ivin/desktop shot` (about 10 s). It builds the app, launches it in the background on the scripted harness with a fresh user data folder, plays a short scenario (new session, a message, a tool call waiting for approval), and prints the path of one window-only PNG per step in `apps/desktop/shots/`. The last PNG shows the approval.

Read one PNG at a time: each is a full-resolution capture, and several at once overflow the context.

To see another state, add a step to `apps/desktop/scripts/shot.ts`; the helpers of `apps/desktop/e2e/` drive the window.

## Wrong tools

- `screencapture` captures the whole screen: the terminal lacks the Screen Recording permission, so it shows only the wallpaper.
- `osascript` needs the Accessibility permission, which the terminal lacks too.
- `pnpm package` takes minutes and belongs to the e2e tests.
