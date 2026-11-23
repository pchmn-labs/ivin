---
name: launch-ivin
description: Launch ivin to show it to the user or to screenshot it yourself. Use when running or screenshotting ivin, checking a change in the real app, or showing a UI change in a pull request.
---

# Launch ivin

## The user sees it

Run `pnpm dev` in the background, then tell the user the app is up so they switch to it themselves. It keeps its own data (`ivin-dev`, `~/.ivin-dev`) and starts empty: it never shows the installed app's sessions.

To try a session by hand, open `ivin-playground`, a folder beside the main checkout, as the project (`git init` it when missing). A session runs a real agent in its project folder, leaving its files and its Claude Code history there, so the playground keeps them out of the ivin repo.

## You see it

Run `pnpm --filter @ivin/desktop shot` (about 10 s). It plays a scenario ending on a tool call waiting for approval, and prints the path of one window-only PNG per step in `apps/desktop/shots/`.

Read one PNG at a time: each is a full-resolution capture, and several at once overflow the context.

To look closely at a spacing or a colour, crop the capture with `sips --cropToHeightWidth <h> <w> --cropOffset <y> <x> <png> --out <out.png>` and enlarge the crop with `sips -z <h> <w> <out.png>`. Python has no PIL here.

To see another state, add a step to `apps/desktop/scripts/shot.ts`; the helpers of `apps/desktop/e2e/` drive the window.

## In a pull request

A pull request that changes what the user sees shows it in one or two captures. When no step of `shot` shows the change, add one to `apps/desktop/scripts/shot.ts` that does. Read the captures before the commit: they catch what the browser tests miss (a wrapped badge, a nameless row). When the work fixes something the user pointed at in a screenshot, show them the new capture and wait for their approval before the commit.

Run `.agents/skills/launch-ivin/pr-shots.sh <png>...` from the branch with the chosen PNGs. It pushes them to `pr-screenshots`, a branch that holds only screenshots and is never merged, and prints the Markdown to paste into the body's Screenshots section.

## Other tools

Only `shot` captures the window: `screencapture` shows the wallpaper and `osascript` fails, because the terminal has neither the Screen Recording nor the Accessibility permission. `pnpm package` takes minutes and belongs to the e2e tests.
