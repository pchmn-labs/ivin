---
name: ivin
description: A desktop app to run and supervise coding agents, in the forest theme.
colors:
  ground: "#161e1a"
  ground-subtle: "#0b110e"
  ground-raised: "#1e2823"
  ground-card: "#0b110e"
  hover-wash: "rgba(169, 217, 160, 0.06)"
  active-wash: "rgba(169, 217, 160, 0.11)"
  hairline: "rgba(214, 235, 220, 0.08)"
  hairline-strong: "rgba(214, 235, 220, 0.15)"
  text: "#e4ebe6"
  text-prose: "#cbd2ce"
  text-muted: "#9daba2"
  text-faint: "#788a7e"
  yew: "#a9d9a0"
  yew-hover: "#bde5b5"
  yew-contrast: "#0b2318"
  bubble: "color-mix(in srgb, #a9d9a0 14%, #1e2823)"
  cursor-red: "#f0644a"
  cursor-red-subtle: "rgba(229, 83, 59, 0.14)"
  amber: "#e2b04f"
  amber-subtle: "color-mix(in srgb, #e2b04f 8%, transparent)"
  amber-outline: "color-mix(in srgb, #e2b04f 60%, transparent)"
  project-hue-0: "#8fbf98"
  project-hue-1: "#8fadd6"
  project-hue-2: "#d2b273"
  project-hue-3: "#bc98cc"
  project-hue-4: "#cf9d80"
  project-hue-5: "#7fc0ba"
  claude-mark: "#d97757"
  ground-light: "#eeede2"
  ground-subtle-light: "#e9e8db"
  ground-raised-light: "#f7f6ee"
  ground-card-light: "#e4e4d5"
  hover-wash-light: "rgba(42, 56, 28, 0.05)"
  active-wash-light: "rgba(42, 56, 28, 0.09)"
  hairline-light: "rgba(42, 56, 28, 0.12)"
  hairline-strong-light: "rgba(42, 56, 28, 0.2)"
  text-light: "#1c2a1f"
  text-prose-light: "#1c2a1f"
  text-muted-light: "#4f5a49"
  text-faint-light: "#5b6555"
  yew-light: "#2f6a3c"
  yew-hover-light: "#265833"
  yew-contrast-light: "#ffffff"
  bubble-light: "color-mix(in srgb, #2f6a3c 16%, #f7f6ee)"
  cursor-red-light: "#b8432b"
  cursor-red-subtle-light: "rgba(184, 67, 43, 0.1)"
  amber-light: "#8f6411"
  project-hue-0-light: "#3f7a4c"
  project-hue-1-light: "#3d6496"
  project-hue-2-light: "#87661a"
  project-hue-3-light: "#76508e"
  project-hue-4-light: "#93593a"
  project-hue-5-light: "#2f7570"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
  title-lg:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "16px"
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "20px"
  transcript-body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "24px"
  transcript-mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
rounded:
  sm: "4px"
  md: "6px"
  lg: "10px"
  card: "10px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.yew}"
    textColor: "{colors.yew-contrast}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  button-primary-hover:
    backgroundColor: "{colors.yew-hover}"
  button-secondary:
    backgroundColor: "{colors.ground-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  button-secondary-hover:
    backgroundColor: "{colors.hover-wash}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  button-ghost-hover:
    backgroundColor: "{colors.hover-wash}"
    textColor: "{colors.text}"
  button-danger:
    backgroundColor: "{colors.cursor-red-subtle}"
    textColor: "{colors.cursor-red}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  button-sm:
    padding: "0 8px"
    height: "24px"
    typography: "{typography.label}"
  text-field:
    backgroundColor: "{colors.ground-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  sidebar-card:
    backgroundColor: "{colors.ground-card}"
    rounded: "{rounded.card}"
    width: "300px"
  project-badge:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ground-card}"
    typography: "{typography.caption}"
    height: "16px"
    padding: "0 4px"
  list-row:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "30px"
  list-row-hover:
    backgroundColor: "{colors.hover-wash}"
  list-row-selected:
    backgroundColor: "{colors.active-wash}"
  list-row-attention:
    backgroundColor: "{colors.amber-subtle}"
  tree-row:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0 8px 0 4px"
    height: "24px"
  tree-row-active:
    backgroundColor: "{colors.active-wash}"
  group-label:
    textColor: "{colors.text-faint}"
    typography: "{typography.caption}"
  group-label-needs-you:
    textColor: "{colors.amber}"
  block-subtle:
    backgroundColor: "{colors.ground-subtle}"
    rounded: "{rounded.md}"
  block-bubble:
    backgroundColor: "{colors.bubble}"
    rounded: "{rounded.card}"
    padding: "10px 12px"
  block-danger:
    backgroundColor: "{colors.cursor-red-subtle}"
    textColor: "{colors.cursor-red}"
    rounded: "{rounded.md}"
  sub-view-tab:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "0 4px 0 12px"
    height: "26px"
  sub-view-tab-selected:
    backgroundColor: "{colors.active-wash}"
    textColor: "{colors.text}"
  code-view:
    textColor: "{colors.text-prose}"
    typography: "{typography.mono}"
  changed-on-disk-bar:
    backgroundColor: "{colors.cursor-red-subtle}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    padding: "4px 8px 4px 12px"
  code-block:
    backgroundColor: "{colors.ground-subtle}"
    typography: "{typography.mono}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  action-sheet:
    backgroundColor: "{colors.ground-raised}"
    rounded: "{rounded.lg}"
    padding: "12px"
  option-list-option:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
    height: "36px"
  option-list-option-selected:
    backgroundColor: "{colors.active-wash}"
  menu:
    backgroundColor: "{colors.ground-raised}"
    rounded: "{rounded.lg}"
    padding: "4px"
  menu-item:
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "28px"
  menu-item-highlighted:
    backgroundColor: "{colors.active-wash}"
  tooltip:
    backgroundColor: "{colors.ground-raised}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  dialog:
    backgroundColor: "{colors.ground-raised}"
    rounded: "{rounded.lg}"
    padding: "20px"
    width: "420px"
  composer:
    backgroundColor: "{colors.ground-raised}"
    rounded: "{rounded.lg}"
    padding: "8px"
---

# Design System: ivin

## Overview

**Creative North Star: "The Quiet Workbench"**

ivin uses the layout every agent app ships: a project and session column, a tab bar, a transcript, a composer. It is finished to the level of Linear, Zed and Raycast, with fewer facts per row than Linear. The look is calm and flat, built for a window that stays open all day. Neutrals are tinted from the app icon's forest greens. Yew green is the one accent. Amber appears only when the user is needed, and the icon's red cursor only when something failed.

All colours, sizes, radii and durations are `--iv-` CSS custom properties in `packages/ui/src/core/theme/tokens.css`. A theme changes the app by overriding those variables. The built-in theme is "forest", in a dark and a light variant, and follows the system appearance unless `data-theme` forces one. The dark variant is deep forest green; the light variant ("Mousse") is a warm moss-paper, with borders and washes in a warm olive ink. Plugins get the same components as the built-in screens, only through `@ivin/plugin-api`. The reasons are in `docs/adr/0002-design-system-on-base-ui-and-css-custom-properties.md`.

The design does without dense dashboards, IDE chrome and decoration.

**Key Characteristics:**
- Flat, tinted neutrals. Depth comes from four ground tones (deep, ground, card, raised) and 1px hairlines.
- One green accent and two signals, each with a single job: amber for "the user must answer", red for "something failed". Dashed amber goes around what the user must answer.
- System UI type at 13px body, with mono for code, commands and paths.
- A 4px grid, 28px controls (`--iv-control-md`; 24px small, `--iv-control-sm`), 30px list rows (`--iv-row-height`), 6px corners on controls and 10px on surfaces.
- Shadows only on overlays: menus, tooltips and dialogs. The sidebar card floats by inset and border, not shadow.
- Every value is a `--iv-` token a theme file can override; a harness mark's brand colour and a file icon theme's icons are the two exceptions.

## Colors

The palette is green-tinted neutrals, one yew-green accent, an amber and a cursor red signal, six project hues and the harness marks' brand colours (Claude's orange). Each theme colour has a light-theme counterpart (the `-light` keys).

### Primary
- **Yew Green** (`--iv-accent`): the primary button, the selected tab bar, the focus ring, the caret, links, text selection (32% mix), the connected dot, the "working" status mark and the working ring on the session mark. In light it darkens to a deep forest green so white text on it stays legible.
- **Yew Hover** (`--iv-accent-hover`): hover and press on the primary button.
- **Yew Contrast** (`--iv-accent-contrast`): text on a yew fill.
- **Bubble** (`--iv-bubble`): the user's message. Yew mixed into the raised ground (14% in dark, 16% in light), so the user's own words read as theirs without a second accent.

### Secondary
- **Amber** (`--iv-attention`): the "waiting for you" status, the "Needs you" group label and count, the project rail badge, the project strip's waiting dot, and the title and icon of the approval and question sheets. An approval is a question, not a fault, so it does not take the red. In light it deepens to a dark ochre so the badge's card-coloured count stays legible.
- **Amber Wash / Hover** (`--iv-attention-subtle`, `--iv-attention-hover`): amber at 8% and 13%, the fill of every row of a session waiting on the user, in the session list and the Working panel, at rest and on hover.
- **Amber Outline** (`--iv-attention-outline`): amber at 60%, used only as a dashed 1px line around something the user must answer.
- **Cursor Red** (`--iv-danger`): the "failed" status, errors, failed tool calls, the lost-server dot on the Settings gear and destructive menu items. Taken from the red terminal cursor in the app icon.
- **Cursor Red Wash** (`--iv-danger-subtle`): the fill of error blocks and danger buttons.

### Tertiary
- **Project Hues** (`--iv-project-hue-0` to `-5`): sage, slate blue, ochre, lilac, clay and teal, muted in dark and deepened in light. A project's pixel creature takes one hue, chosen from its name. They identify projects and nothing else.
- **Harness brand colours** (set in `harness-mark.css`): each harness mark keeps its harness's brand colour, fixed across themes; Claude's mark is orange (`claude-mark`). A harness with no mark of its own shows the neutral agent mark, a ring around a dot in muted text.

### Neutral
- **Forest Ground** (`--iv-bg`): the window, the main area and the transcript.
- **Card Ground** (`--iv-bg-card`): the floating sidebar card. In both themes it is a step darker than the ground; in dark it shares the deep ground's tone.
- **Deep Ground** (`--iv-bg-subtle`): code blocks, subtle blocks and table headers.
- **Raised Ground** (`--iv-bg-raised`): controls, the composer, the action sheet, menus, tooltips and dialogs.
- **Hover Wash / Active Wash** (`--iv-bg-hover`, `--iv-bg-active`): translucent washes (green in dark, olive in light) for hover, press, the selected row, the selected option, the highlighted menu item and inline code.
- **Hairline / Strong Hairline** (`--iv-border`, `--iv-border-strong`): dividers, the sidebar card and block borders (hairline); controls, overlays, the composer and the action sheet, and scrollbar thumbs (strong).
- **Text / Muted / Faint** (`--iv-text`, `--iv-text-muted`, `--iv-text-faint`): primary copy; secondary copy, ghost buttons and the composer's run options button; metadata, group labels, key hints, placeholders, timestamps and the idle status.
- **Prose** (`--iv-text-prose`): the transcript's prose: the user's messages, the agent's sentences and its Markdown answer. In dark it is slightly dimmer than Text, to soften the contrast of long text on the dark background; in light it equals Text. Labels in the transcript (tool names, commands, image chips) keep Text.

### Named Rules
**The One Accent Rule.** Yew green marks focus, selection, the primary action and "working". It never decorates.

**The Amber Asks, Red Fails Rule.** Amber marks only what needs the user (waiting, an approval); cursor red marks only what went wrong (error, failure). A status colour goes through `--iv-status-working`, `--iv-status-waiting`, `--iv-status-idle` or `--iv-status-failed`, never a raw colour.

**The Token-Only Rule.** No colour, font or size outside the `--iv-` tokens. Derived tints use `color-mix()` on a token (accent blocks at 8% fill and 40% border, the bubble at 14% or 16%, the selected tab at 12%, the checkout buttons at 14% and 22% on hover, the amber wash at 8% and 13%, the amber outline at 60%, the composer's focus border at 45% over the strong hairline). The exceptions are a harness mark's brand colour, which belongs to the harness, not the theme, and a file icon theme's icons in the Files tab, which keep the icon theme's colours.

## Typography

**Body Font:** the system UI font (`-apple-system`, SF Pro Text, `system-ui`, Segoe UI)
**Mono Font:** `ui-monospace` (SF Mono, Menlo)

**Character:** the platform's own UI type, so ivin reads like a native desktop tool. Text keeps macOS's default rendering: no `font-smoothing` override, which would thin the strokes. Mono marks anything the user could type or paste: code, commands, file paths, the command an approval asks about.

### Hierarchy
- **Headline** (600, 20px/28px): level-1 headings inside Markdown answers.
- **Title Large** (600, 16px/24px): dialog titles and level-2 Markdown headings.
- **Title** (600, 14px/20px): the project name at the head of the session list and level-3/4 Markdown headings.
- **Body** (400, 13px/20px): the default for the whole app: row titles, options, controls, the composer.
- **Transcript Body** (400, 14px/24px): the user's message, the agent's text and the Markdown answer in the transcript.
- **Label** (500, 12px/16px): small buttons, field labels, tooltips, status labels, the session title in the main title bar, the composer's run options button, tool arguments and a failed tool's status.
- **Caption** (500, 11px/16px): the session group labels with their counts, the project badge (600), and the key shown on an option list row.
- **Mono** (400, 12px/20px): code blocks, tool arguments, file paths and the approval detail (clamped to three lines). Inline code is 0.92em. A command on a row (`Text` `code`, a Working panel approval) is 11px mono on the subtle ground in a hairline frame with 4px corners.
- **Transcript Mono** (400, 13px/20px): tool arguments, file paths, code blocks and other mono text in the transcript. Inline code stays 0.92em of its line.

Weights are 400, 500 and 600 only. Times, counts and costs use tabular figures.

### Named Rules
**The Native Type Rule.** Body copy is 13px system UI. Hierarchy comes from weight and muted tones, not size jumps. 20px is the largest size and appears only inside Markdown. The transcript is the one place set larger, for long answers: 14px text and 13px mono, and its 12px labels (the turn line, step summaries, "failed", "Denied:") move to 13px while 11px labels stay. The tokens are scoped to the transcript, so the same `Markdown` and `CodeBlock` keep 13px and 12px elsewhere.

## Layout

The window is a two-column grid. On the left, a floating sidebar card 300px wide by default (`--iv-card-width`), inset 8px from the top, bottom and left window edges. On the right, the main area on the forest ground. The card's right edge resizes it between 240px and 480px, by drag or by the arrow keys once focused (a green line drawn over the card's border, as thick as it, with rounded ends, stopping short of the corners, like the files card's); a double-click returns it to 300px, and the width is kept between launches. The sidebar toggle removes the card, and the main area then takes the full width. With no project open the window is a single centred column. It says "No project open" over the primary Open folder… button; while the projects load it says "Loading the projects…" instead, and when they cannot load, an `ErrorMessage` with Retry says "The projects could not be loaded." with no button.

The card stacks a 40px draggable top row, a body, and the `sidebar.bottom` panel. The macOS traffic lights sit inset 15pt from the card's top-left corner, centred on the top row; the row holds 78px of space for them (`--iv-traffic-lights-width`), then the sidebar toggle, with the Settings button (a gear, "Settings (⌘,)"), back and forward 2px apart at the row's right end, all four ghost icon buttons. While the server is lost or restarting, a 6px red dot (`--iv-dot-size`) sits on the gear's top-right corner, ringed in the card colour, and an `ErrorMessage` sits under the window's top bar: "ivin's server stopped. Restarting it…" while the desktop app starts it again, and, once it has given up, "ivin's server keeps stopping. Its log is at <path>." with a small ghost "Restart" button, which the Tab key reaches. When ivin has an update to show, an update button sits in that row to the left of the gear: a ghost icon button with a 14px icon, and a 6px dot (`--iv-dot-size`) ringed in the card colour on its bottom-right corner while it is ready or failed. Ready, it is a restart arrow in the accent colour labelled "Restart to update"; downloading, a download arrow in the accent colour; checking by hand, a spinner in the faint colour; failed, a warning triangle in the danger colour. It is absent when there is nothing to show. Hovering or focusing it opens a 300px card under it, with 12px of padding (8px on the right around a failure, so Retry's label sits as far from the top as from the right), on the raised background with the overlay shadow: "ivin 0.4.0 is ready. Restart to update." (or "Downloading ivin 0.4.0 (73%)") in 13px semibold, a "What's changed" heading over the release notes as `Markdown`, and a muted "View release on GitHub" link with an external-link icon; a failure shows its `ErrorMessage` (no network, a fingerprint mismatch whose download ivin deleted, or a folder ivin cannot write to, which says to move ivin to a writable folder such as `/Applications`) with Retry, and clicking a failed button retries too. Clicking the ready button restarts ivin at once; with agents running it first opens a `Dialog` "Restart ivin to update to 0.4.0?" that says how many agents are running and that they stop now and resume with the next message in their session, lists their titles, and has Cancel and a primary "Restart and update". The Check for updates command (`update.check`) has no default key, and says "ivin is up to date (0.3.2)." in a notification when nothing newer exists. The body follows the `sidebar.layout` setting. With the rail, the default, it splits into a 44px project rail (`--iv-rail-width`, a hairline on its right) and the list column. With the strip, the list column takes the body's whole width and the project strip closes the card, under the `sidebar.bottom` panel.

When a part of the window fails while drawing, its area keeps its shape: the card frame of the session panel (hairline border, card corners), with a top row the height of the sub-tabs row on the card ground, holding an `ErrorMessage` and a small ghost Retry in place of the tabs, over a hairline, then on the `--iv-bg` ground a faint skeleton of five grey bars (`--iv-bg-active` at 50%, 12px high, `aria-hidden`) in place of the content. A failure of the window itself says "ivin could not draw the window. Your drafts and unsaved edits are kept." with Retry and a ghost "Reload window", and fills the window; Retry keeps drafts and unsaved edits, Reload window drops them. A failure in the session and file area says "This part of the window could not be drawn. The sidebar still works." in that area only, and the sidebar stays usable; switching tab tries the area again. Neither shows the raw error, which goes to `ivin logs`.

The rail holds one 32px button per open project, in order, 8px corners, with the project's 20px pixel creature; an amber count badge sits on its top-right corner for the sessions waiting on the user. The open-folder ghost icon button follows the last project.

The strip is a row above a hairline, 4px by 8px of padding: a ghost Previous project arrow, the projects, and a ghost Next project arrow, each arrow disabled at its end. The projects are 24px buttons (`--iv-strip-button-size`), 8px apart, 6px corners, each with the 12px creature; they sit centred between the arrows, and once they no longer fit the row scrolls sideways with no scrollbar and keeps the selected project in view. The selected button takes the raised background, the hairline ring and the faint shadow, as in the rail. A project with sessions waiting on the user shows a 6px amber dot on its top-right corner, ringed in the card colour; the count is in its tooltip and label. Opening a folder goes through the project menu.

The list column opens with a 36px head: the selected project's 16px creature, its name in 14px semibold (with the strip, both inside the project select: a 28px ghost button ending in a faint chevron, whose menu lists the open projects with their 16px creature, an amber count of their waiting sessions and a check on the selected one, then Open folder…), New session, and an ellipsis menu with Archived sessions (⇧⌘A) and Close project. Under it, the sidebar tabs (see Navigation), and under them the selected tab's panel. The Sessions tab lists the project's sessions that have an open tab, in tab order, under a "Sessions" caption label with its count; a session waiting on the user keeps its place and takes the waiting row style. A project with no open tab shows no sentence there; its inactive sessions come first. Until its tabs first arrive, the Sessions caption stands over four placeholder rows (a 16px disc and two bars, `--iv-bg-active` at 50% pulsing between 35% and 65% over 900ms, still under reduced motion). When the sessions or the tabs cannot load, an `ErrorMessage` with Retry says "The sessions could not be loaded." in place of the list; when the list already has rows, they stay under an `ErrorMessage` with Retry saying "Sessions may be out of date." Rows are 4px apart inside 8px side padding.

The `sidebar.bottom` panel spans the whole card width under the rail and the list column, above a hairline, and is absent when no contribution renders. It is at most 45% of the card tall by default and scrolls inside; its top edge resizes it by drag or arrow keys, up to 70% of the card, and a double-click returns it to the default. Its built-in contribution is the Working panel: a folding head "Working · N", with "· M need(s) you" in amber, that stays in view while its rows scroll, then the sessions of every open project that wait for an approval or the agent's questions, then a "Running" group of those that run, except the one on screen. The waiting sessions' group label, "Needs you", is for screen readers only, since the head counts them right above. A running row has the session mark, the title, the elapsed time in its status and, on a second line, the project's 12px creature and name. A waiting row has no elapsed time. One waiting for an approval has the title alone on its first line, then under it, inside its frame, the command on one line in 11px mono on the subtle ground in a hairline frame with 4px corners (lines continued with a backslash joined, cut with an ellipsis), then the project's creature and name on the left and a small secondary Allow and a ghost Deny on the right; the whole command shows in a mono tooltip titled "Approval needed" after a hover anywhere on the row. One waiting on the agent's questions has the project and the first question in muted text on its second line, with no buttons. A session in background is listed under "Running" with the same pulsing dot, and a second faint muted segment after its project, "[bg] Review the diff +2": its first task and how many others run. A click on a row opens its session's tab, and the approval sheet then takes the keyboard focus.

The main area opens with a slim 40px draggable title bar holding the selected project's tab bar (see Navigation). With no session open, the main area centres a muted "No session open" over a primary "New session" button with the new-session icon, 16px apart, as the screen with no project does with Open folder…. Its tabs start 8px from the top, level with the sidebar card's top edge, and end 8px above the transcript and the files card, the same gap as between the sidebar card and the files card. When the sidebar is closed the traffic-light space and the shell controls move into the bar, which then starts 8px from the top so its row stays centred on the traffic lights, and the content under it moves 5px down. Below it come the transcript and the composer, which share a centred column at most 928px wide (`--iv-content-width`), with 24px side padding. Transcript items are separated by 8px of vertical padding, and the last one's text ends 40px above the composer. The transcript's top edge fades over 8px, from half opacity, so text scrolling under the title bar is not cut sharply. The list is virtualised, so a row's look must stay cheap.

The transcript opens on its end, or where the user had scrolled it. After a message is sent, and while the agent works, the transcript follows its end, however long the turn grows; it leaves no empty room under the last row. It glides to each new end at the pace the turn grows, less than two lines behind it, and jumps under reduced motion or when the end is more than a view away. When the turn ends and its work folds, the view moves in one step to show the sent message at its top if the answer is taller than the view, and stays at the end otherwise; it keeps that place until the user scrolls. Scrolling up stops following, and so does folding or unfolding anything in the transcript; scrolling back to the end follows the end again. Scrolled up, the transcript stays put while the agent writes, even inside the row of the turn that runs. A session with no message shows "No messages yet. Write to the agent below." in muted text. While the transcript loads it shows "Loading the transcript…" in muted text; when it cannot load, that line is replaced by the same header row and skeleton as a part of the window that fails while drawing, saying "The transcript could not be loaded." with Retry, or "This session no longer exists." without Retry.

A tab with open files shows them beside the chat, in a files card like the sidebar card: card ground, hairline, 10px corners, inset 8px from the chat, the right window edge and the bottom, under the title bar. The chat keeps the left part and the card takes a little more (1 to 1.15), and both shrink with the window, the chat down to 320px (`--iv-chat-min-width`) and the card to 280px. The card's left edge resizes it, by drag or by the arrow keys once focused (a green line drawn over the card's border, as thick as it, with rounded ends, stopping short of the corners), between 280px and what leaves the chat 320px; a double-click returns it to the 1 to 1.15 share, and the width is kept between launches, for every tab. In full width it has no handle. The card stacks a 36px row of tabs above a hairline and the selected file. Closing its last file closes the card, and the chat takes the whole width again.

In full width the card covers the whole main area under the title bar, inset 8px from the sidebar card, the window edge and the bottom, and its row starts with a Session tab: the session's 14px harness mark and "Session", with no × and 11px left and 14px right padding so the round mark and the text look balanced, then a 1px by 16px hairline divider 4px from each side, then the open files. Selecting Session shows the chat inside the card, under the row, on the main area's ground, while the row keeps the card ground; the rest of the card takes the main area's ground too, so the hairline around the chat shows as it does on the main area, not as on the card ground. Selecting a file hides the chat but keeps its scroll and its draft. Beside the chat there is no Session tab, since the chat is already on screen.

Spacing is a 4px grid (`--iv-space-1` to `--iv-space-10`). Layout gaps go through `Stack` at 0, 4, 8, 12, 16, 24 or 32px. Screens and plugins carry no inline styles: layout goes through `Stack`, `Block`, or a CSS file beside the screen.

## Elevation & Depth

The app is flat at rest. Depth comes from four ground tones and 1px hairlines. The sidebar card reads as floating because it is inset from the window edges, sits on its own card ground and carries a hairline; it casts no shadow. The action sheet docks onto the composer and shares its edge rather than rising above it. Only things that float above the window cast a shadow: menus, tooltips and dialogs. A dialog adds a dim backdrop (`--iv-backdrop`, set per theme) and a strong hairline.

### Shadow Vocabulary
- **Overlay** (`--iv-shadow-overlay`): menus, tooltips and dialogs. In dark, `0 8px 24px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3)`; in light, the same shape in a soft green-black.

A zero-blur `box-shadow` ring that stands in for a border (the selected rail button's and the selected tab's 1px ring, the badge's 2px card-coloured ring, the idle status ring) is a line, not elevation.

### Named Rules
**The Overlays-Only Rule.** A shadow means "this floats above the window". Blocks, the sidebar card, the composer, the action sheet, rows and buttons never cast one.

## Shapes

Corners are gently rounded in three sizes: 4px (`sm`) for menu items, tooltips, inline code and the bubble's tail corner; 6px (`md`) for buttons, fields, rows, options, blocks and code blocks; 10px (`lg`) for the composer, the action sheet, menus, dialogs, and scrollbar thumbs. Large surfaces that frame the app take `--iv-radius-card` (10px): the sidebar card and the bubble. The user's bubble is rounded on three corners and keeps a 4px corner at the bottom right, toward the user's side.

Borders are 1px. The 2px lines are the tab drop line (`--iv-line-bold`); the selected tab bar is 3px. Status marks and overlays on the session mark are circles; the project badge is a pill. Project creatures are 8 by 8 pixel grids drawn with crisp edges, at 16px in the project column and 12px in a Working panel row.

### Named Rules
**The Dashed Amber Rule.** A dashed 1px line in `--iv-attention-outline` means "the user must answer". It goes around a waiting session row and the approval and question sheets, and nowhere else. A solid red line means an error, not a question.

## Components

Components live in `packages/ui/src/core/components/<component>/`, one folder each, built on Base UI where behaviour matters (menu, dialog, tooltip, tabs). Plugins get them through the `HostComponents` in `packages/plugin-api/src/components.ts`, which take data rather than compound children.

### Choosing a component
Pick by what the user does; the sections below give each component's look.

| When the user… | Use | Not |
|---|---|---|
| runs one action from a short list behind a button (Rename, Archive, Delete…), or picks one of a few choices there with a check on the current one | `Menu`; `ContextMenu` for the same list on a right click | `Select`, whose field shows the current value |
| picks a value under the composer (working folder, branch) | `ComposerMenu` | `Menu`, which has no search field or footer |
| sets several values side by side from one button, each from a short list (the run options) | `ColumnMenu` | one `ComposerMenu` per value, which takes a button and an opening each |
| sets a value in a form, among a few fixed options | `Select` | `Menu`, whose button does not show the current value |
| answers an approval | `ActionSheet` on the composer, holding an `OptionList` | `Dialog`, which hides the transcript the approval depends on |
| answers the agent's questions | `ActionSheet` on the composer, with `Steps` in its title row and a `ChoiceList` | `OptionList`, which has no check boxes, descriptions or own answer |
| confirms an action that cannot be undone, or fills a short form before one | `Dialog` | `ActionSheet`, which only carries what the composer waits on: an approval, the agent's questions, a failed relaunch |
| reads more of a cut label, a command or a path | `Tooltip` | a tooltip holding a button or a link |
| browses items to open or act on (sessions, archived sessions) | `ListRow`, inside a `ListSection` when the list is grouped | `OptionList`, which submits one choice |
| browses nested items that open level by level (a folder's files) | `Tree` | nested `ListRow`s, which are not virtualised and do not take the arrow keys |
| narrows a list or a tree by typing | `SearchField` above it | a `TextField`, which has no magnifier and does not empty on Escape |
| jumps to one item among many by typing its name, from anywhere (a file) | `QuickPick`, opened by a command | a `Dialog` holding a field and a list |
| reads why a panel's list shows nothing or only part (no changes, an empty folder, no session on screen, commits that cannot be listed, a cut list) | `EmptyMessage` in place of the list or beside it: faint 12px text with 4px above and under and 8px at the sides, so it starts where a `ListSection`'s label does | a bare `Text`, which starts 8px left of the rows |
| sees that an action failed | `ErrorMessage` under what failed, with Retry when retrying can work, and a `CodeBlock` when there is output to read (git's) | a danger `Block`, which is for an error in the transcript |
| sees that a command run from a key failed and its target is hidden, or a plugin has something to say that no screen shows | `notify`, which draws a `Notification` in the corner of the session's chat | an `ErrorMessage`, which needs the screen the failure belongs to |
| reads code or a command's output | `CodeBlock`, inside a `Disclosure` when it is secondary, as tool output is | `Markdown`, which is for the agent's answer |
| sees a session's status | `SessionMark` | `StatusMark`, which shows no harness |
| turns a setting on or off, applied at once | `Switch` | a checkbox, which reads as a choice to submit later |
| switches one view between two or three ways of showing the same thing (an SVG's image and source) | `Segmented` | `Tabs`, which head a panel of their own |

### Buttons
- **Shape:** 6px corners, a 1px border slot, 500 weight. Medium is 28px tall with 12px side padding; small is 24px tall with 8px padding and 12px text. Icon buttons are square.
- **Primary:** yew fill with yew-contrast text. One per surface: Send, Open folder.
- **Secondary (default):** raised ground, strong hairline, default text: the composer's Stop.
- **Ghost:** transparent and muted, for toolbar, shell and row actions, and New session.
- **Danger:** red wash and red text.
- **States:** hover changes fill only (yew hover on primary, hover wash elsewhere) over 120ms; press uses the active wash; disabled drops to 45% opacity (`--iv-opacity-disabled`, shared by fields, selects, menu items and options). Focus is the global 2px yew outline, 2px offset.

### Icons
Phosphor icons at regular weight (the question icon filled, as the session mark's status overlay is), 16px by default and 14px inline with small text, drawn through `Icon` from a fixed list of names (plus, question, folder-open, send, square, check, x, chevrons, ellipsis, terminal, file, pencil, circle-alert, loader, copy, git-branch, brain, wrench, user, sparkles, arrows, arrow-down, arrows-left-right, panel-left, new-session, search, archive, trash, restore, gear, brackets-curly, app-window, collapse-all, eye, eye-slash). A screen or plugin asks for a name, never imports an icon. The loader spins on `--iv-duration-spin` (900ms), and keeps spinning under reduced motion, as the session mark's Working ring does, so a waiting screen never looks stuck; every other reduced-motion rule stops its motion.

### Blocks
- **Use:** the box for a transcript item. 1px hairline, 6px corners, padding 8, 12 or 16px.
- **Tones:** plain (transparent); subtle (deep ground, the default); accent (yew at 8% fill and 40% border); danger (red wash and a 40% red border, for errors); bubble (the user's message, see below).
- **Bubble:** the user's message, full column width, no border, 10px by 12px padding, on the bubble colour, with the 10/10/4/10 corner shape. Claude's answer is never a bubble: it is plain Markdown with no speaker label.

### Inputs / Fields
- **Style:** raised ground, strong hairline, 6px corners, 28px tall. The text area grows with its content up to 240px. Placeholders are faint.
- **Focus:** the border turns to the focus ring colour.
- **Disabled:** 45% opacity (`--iv-opacity-disabled`). A select matches a field with a muted chevron.
- **Segmented:** 2px of room inside a 6px-corner raised box with a hairline, holding a 22px option per value in muted 12px text, 4px corners; the hover wash on hover, and the active wash with the text colour on the chosen one. Click, Enter and Space choose an option; choosing the chosen one keeps it.
- **Switch:** a 30 by 18px pill on the raised ground with a strong hairline, holding a 12px muted round thumb; on, the pill turns yew with no border and the thumb, in yew contrast, slides 12px right over 180ms on `--iv-ease-out` (no slide with reduced motion). Click and Space turn it over. It applies its value at once, so it carries no Save button.

### List Rows
- **Style:** 30px tall, 6px corners, 8px padding: a leading mark, 12px of space, a truncated title, then faint tabular metadata (relative time). A row with a second line has 8px above and under its two lines, 2px apart. A row's actions (the session ellipsis) show only on hover, keyboard focus, or while their menu is open, the selected row included.
- **States:** hover wash; selected rows take the active wash and 500 weight; a row whose session waits on the user takes the dashed amber outline, inset by 1px, and the amber wash (amber hover on hover), unless it is selected, when the active wash stays. Row actions appear only on hover, focus or while their menu is open. Controls under a row (`below`) sit inside its frame, aligned with the title, and share its hover; a row's `tooltip` opens on its right.

### Session Mark
The signature of the session list: the 16px mark of the session's harness with a small circular overlay at its bottom-right, over a transparent hole cut in the harness mark, so any row or tab background shows around it. Working is a 10px yew ring with one open quarter, spinning on `--iv-duration-spin`, still under reduced motion. Waiting is an 11px amber disc with a "!" cut through it for an approval, a "?" for the agent's questions. Failed is a 10px hollow red ring. In background is a 9px yew disc that breathes (its ring of glow and its opacity pulse over `--iv-duration-pulse`; still with reduced motion), in place of the spinner, since no turn runs; after a hover, a tooltip titled "N tasks in background" lists the tasks, each with its robot (subagent) or terminal (command) icon. Idle shows no overlay. The status always has a hidden label for screen readers.

### Status Mark
A labelled status for plugins. Working is a 6px yew dot pulsing over 1.6s (`--iv-duration-pulse`). Waiting is a larger 8px amber dot. Idle is a faint 1.5px ring. Failed is red. It always carries a label, visible or hidden.

### Navigation
- **Project rail:** a 44px column of 32px project buttons with 8px corners (`--iv-rail-button-size`), each showing the 20px creature. The selected button takes the raised background, a 1px hairline ring and a faint shadow (`--iv-shadow-raised`); an unselected one takes the hover wash on hover. The label and tooltip are the project's name, with " · N waiting for you" when sessions wait. The amber pill badge (`--iv-badge-size` tall, 11px semibold tabular count) sits on the button's top-right corner, ringed in the card colour. The open-folder ghost icon button follows the projects.
- **Project strip:** the `strip` layout's row of 24px project buttons at the card's foot, with Previous and Next project arrows (⌃⌘[ and ⌃⌘], `project.previous` and `project.next`, which also work with the rail). A 6px amber dot marks a project with sessions waiting on the user.
- **Trust dialog:** opening a folder in no trusted project asks first, in a `Dialog`: "Trust “<name>”?", "ivin runs git and the agent in this folder, and both run commands its own files can set up, such as git hooks and the agent's project settings. Trust it only if you know where it comes from.", the folder's path in faint 11px mono, then Cancel, focused first, and a primary "Trust and open"; Cancel leaves the folder unopened.
- **List head:** 36px (`--iv-list-head-height`): creature, project name, New session, and a ghost ellipsis menu holding Archived sessions and Close project.
- **Archived sessions:** the list column's view of the project's archived sessions, in place of its sessions. Its head is a ghost back arrow, "Archived sessions" in 14px semibold and the faint count. Rows are session rows: the harness mark with no status, the title, the branch line, and the time since it was archived; Restore and Delete icon buttons appear on hover or focus. The focused row takes the active wash. Up and Down move between rows, Enter restores, ⌘⌫ deletes, Escape or the back arrow returns to the sessions. A faint footer under a hairline lists those keys. With none: "No archived sessions in <project>." and how to archive one.
- **Session actions:** a session row's ellipsis menu holds Rename, a separator, Archive and a red Delete…; an inactive session's row has the same Archive and Delete…, and a right click on a tab opens them too. Archiving a working or waiting session asks first ("Archive the session and stop its agent?", Cancel and a danger "Stop and archive"); every delete asks first, naming the session ("Delete “<title>”?", Cancel and a danger "Delete session"). A failed archive, restore, delete or rename shows its message under the session's row; a failed rename also offers Retry. A failed send shows its message and Retry above the session's composer, with the message back in the field, even when the user was on another tab when it failed.
- **Session groups:** caption labels in faint text with a tabular count; "Needs you" is in amber. A `ListSection` with `hideLabel` keeps its label for screen readers only.
- **Tab bar:** in the 40px main title bar, the selected project's tabs followed by a ghost New session icon button (plus; it starts a session with the last run options of its project). A tab is `--iv-tab-height` (30px) tall with `--iv-radius-tab` (8px) corners, `--iv-tab-width` (240px) wide whatever its title, shrinking equally with the room left down to `--iv-tab-min-width` (180px) before the bar scrolls, 4px apart, its title cut with an ellipsis. It shows the session mark, then the title in muted 500-weight small text. The selected tab takes the raised background with 12% yew mixed in, a 1px strong hairline ring and a main-colour title; an unselected tab takes the hover wash on hover. A 20px close button (14px x) appears only on hover or keyboard focus; the title gives it room, the tab keeps its width. The close button is for the mouse, as in Chrome: out of the Tab order and hidden from screen readers, so the tab list holds only tabs. A middle click also closes a tab, and Close the session's tab (`tab.close`, ⌘W) closes the selected one, asking first as the close button does. ⌘W never closes the window; ⌘Q and the window's close button do. The bar scrolls sideways with no visible scrollbar. Tabs reorder by drag, with a 2px yew drop line, or from anywhere in the window with Move the session's tab left and right (`tab.moveLeft`, `tab.moveRight`, ⌃⇧PageUp and ⌃⇧PageDown as in Chrome), which move the selected tab one place and stop at either end; Left, Right, Home and End move between tabs. Unselected tabs have no separators between them.
- **Tabs (component):** the tabs for inside a panel: 32px tall, muted 500-weight labels, over a hairline, the active tab marked by a 16px by 3px yew bar with round ends, centred under its name (not its badge) on the hairline, that slides to the newly selected tab over 180ms on `--iv-ease-in-out` (no slide with reduced motion). The tab bar above does not use it.
- **Sidebar tabs:** the `Tabs` component across the list column, under its head: Sessions, then one tab per plugin panel (Files, Changes). A tab may follow its name with a badge, 6px after it: a 14px pill on the active wash holding a muted 11px tabular count, such as the Changes count (the files the session changed, uncommitted or committed, each counted once), shown only while there is one. ⌘1, ⌘2 and ⌘3 select them, show a hidden sidebar and put the focus in the panel (the selected session row, the tree, the first change); Left and Right move between them once focused. The selected tab is kept between launches. A plugin panel sits 8px inside the column, 12px above its bottom.
- **File tree:** the Files panel opens on a row of tools: the working folder in faint 11px mono, after a 12px folder or worktree icon, 4px in so the icon sits where the tree's chevrons do (the project's name for the checkout, its path from the project for a worktree, the full path on hover), then three small ghost icon buttons: a magnifier, "Filter files"; an eye, "Show ignored files" (a struck eye while hidden, an open eye and "Hide ignored files" while shown, pressed); and two arrows pointing at a line, "Collapse all folders", which closes every open folder and is disabled while none is open. Filter files puts a focused `SearchField` (24px, 6px corners, the subtle ground and a hairline that turns to the focus ring, a faint 12px magnifier, 12px text, "Filter files") in place of the working folder and the magnifier; it closes on Escape or when it loses the focus while empty, and stays while it holds text. Under it the `Tree`: 24px rows (`--iv-tree-row-height`) with 4px corners, each level indented 12px (`--iv-tree-indent`), a faint 12px chevron that turns 90 degrees when the folder opens, the row's icon, and the name cut with an ellipsis. The icon is the file icon theme's (Gruvbox Material Icons, from the built-in `file-icons` plugin) at 16px (`--iv-tree-icon-size`) in the theme's own colours, its light variant under a light appearance: by the file's name, its longest extension, the language of its extension, else the theme's file icon; by the folder's name, open or closed, else the theme's folder. With Show folder icons off (`files.folderIcons`), a folder has no icon, the theme's or the faint one: its chevron, then its name. With no icon theme, a faint 14px folder or file icon. The folders keep their chevrons; a file has none, so its icon lines up with the folders' icons beside it; with folder icons off, the chevrons' glyphs start at their box's left edge, and a file's icon starts there too, under its folder's name. A hover takes the hover wash, the active row the active wash, and the focus ring goes around the active row while the tree has the keyboard focus. Selected rows take the active wash. Up and Down move and select the row they land on, Right opens a folder then enters it, Left closes it then goes to its parent, Home and End jump to the ends, Page Down goes to the last row in view, then a page further, and Page Up the same way up, and Enter and Space open and close a folder; each is a keybinding in the `tree` area. Shift with Up, Down or a click extends the selection from where it started, ⌘-click adds a row to it or takes one out, and neither opens anything. Typing a name jumps to the next row that starts with it. When a folder closes over the active row, the folder becomes the active row. A click on a folder opens or closes it. A click, Enter or Space on a file opens it in the files card, or selects it there, and the focus stays in the tree; a file that cannot be opened shows its `ErrorMessage` above the tree. Folders open one level at a time, and what git ignores shows only while the eye is on, its names at 70% of the faint text. The tree follows the disk: a file the agent creates or deletes shows or goes in its open folder as it happens, and a folder deleted with what was open in it just leaves. A changed file's name takes its git status colour (`--iv-git-*`: modified hue 2, added hue 0, untracked hue 5, deleted hue 4, conflicted red), with its letter (M, A, U, C) in 11px mono at the row's right end, while a deleted file shows only through its folder; a folder holding changed files takes the colour of the most pressing of them (conflicted, then modified or deleted, then untracked, then added) and a 5px dot of it instead of a letter. The file selected in the files card is revealed: its folders open, its row is selected and scrolled into view. Text in the filter keeps the files whose name holds it, ignoring case, in every folder of the working folder whether opened or not, each under its folders, all open, with the matched part of the name in 600-weight accent; what git ignores is not searched. Escape empties the filter. "No file matches “<text>”." when none does. With no session on screen: "No session on screen. Open one to see the files of its working folder." An empty folder says "This folder is empty."; a deleted working folder says so; a listing that fails shows its `ErrorMessage` where the tree is, with Retry, and a folder inside that fails shows it above the tree. When git cannot read which files changed, an `ErrorMessage` with Retry sits between the working folder and the tree ("Git could not read which files changed, so the files show no status. Retry."), and the tree stays usable with no status colours.
- **Changes:** the Changes panel follows the session on screen and the disk, and holds two groups, 12px apart, each sorted by path: Uncommitted, the working folder's changes against HEAD with untracked files, and Committed, what the commits of the session's branch changed since its merge base with `origin/<default branch>`, which shows on hover over its heading. A file committed then edited again is in both, each with its own counts. Each group opens on a 24px heading with 4px corners that folds it: a faint 12px chevron that turns 90 degrees when open, its name and its count in faint 11px 500-weight text ("Uncommitted 3", "Committed 5"), the hover wash on hover; Uncommitted's heading ends on a small ghost Discard all icon button (an arrow that turns back), always shown. The tab's badge counts the files the session changed, uncommitted or committed, each file once. Each change is a 26px row with 4px corners, 2px apart: its file icon, the one the Files tab shows, 16px, with its status letter on the icon's bottom-right corner in 8px 600-weight mono on the row's ground (M modified and R renamed hue 2, A added hue 0, U untracked hue 5, D deleted hue 4), the file's name in the same colour (struck through for a deleted file, cut with an ellipsis past 60% of the row), its folder in faint 11px mono cut from the left so the part nearest the file stays, and its line counts in 11px tabular mono at the row's end, "+N" in the added colour and "−N" in the deleted colour (none for a binary or untracked file). A renamed file says where it comes from on hover. A hover takes the hover wash; the row whose diff is on screen takes the active wash. On hover, focus or selection an uncommitted row adds a small ghost Discard icon button after its counts, 8px from them, red on hover; the counts move left to make room and stay shown. The Discard and Discard all buttons are out of the Tab order, as their keys reach them: a focused row and the Uncommitted heading give screen readers their key (`aria-keyshortcuts`), and each button's tooltip shows it after the action through `KeyHints`, as the user's keybindings set it. The panel is one tab stop over both groups: Up and Down move through headings and rows, Home and End jump to the ends, Left folds a heading or goes from a row to its heading, Right unfolds a heading, Enter or a click opens the change's diff in the files card; the commands `changes.discard` (⌫) and `changes.discardAll` (⌘⌫), in the `changes` area, discard the focused uncommitted change and all of them. Discarding asks in a `Dialog`: "Discard the changes to “<name>”?", "The file goes back to its last commit. This cannot be undone." (for an untracked file "Delete “<name>”?", "Git does not track this file, so discarding its changes deletes it. This cannot be undone.", and for a file added since the last commit the same title with "The file is new since the last commit, so discarding its changes deletes it. This cannot be undone."); for all of them "Discard all uncommitted changes?", "3 files go back to their last commit, and 1 new file is deleted. This cannot be undone.", and only the changes it lists are discarded, not one the agent writes while it is open; then the paths in faint 11px mono, Cancel, focused first, and a danger "Discard changes" ("Delete file", "Discard all"). A discard git refuses shows under the file's row, or under the Uncommitted heading for all of them, in 11px red: a 12px alert icon under the file icon, then, lined up with the file's name, the UI's message ("Git could not discard the changes to <name>. Fix what it reports, then discard again.") and git's output in muted mono, wrapped; the next discard clears it. Until the Committed group is listed, an empty Uncommitted group shows nothing. When neither group has a change, one `EmptyMessage` stands for both: "No changes since origin/main. What the agent changes shows up here." Otherwise, in place of the Uncommitted group, in an `EmptyMessage`: "No uncommitted changes. What the agent changes shows up here.", "This working folder is not in a git repository, so it has no changes to show.", "No session on screen. Open one to see its changes.", or a deleted working folder's sentence; a listing git refuses shows its `ErrorMessage` with Retry, and git's output under it in a `CodeBlock`. An open that fails shows its `ErrorMessage` above the groups. In place of the Committed group, in an `EmptyMessage`: "No committed changes since origin/main.", "This repository has no origin remote, so the branch's commits cannot be listed.", "Git does not know origin's default branch, so the branch's commits cannot be listed. Run git remote set-head origin --auto.", or "The branch shares no commit with origin's default branch, so its commits cannot be listed."; a listing git refuses shows its `ErrorMessage` with Retry and git's output.
- **Worktree and branch lists that fail:** the working folder menu and "Where should the agent continue?" show an `ErrorMessage` with Retry where the existing worktrees would be ("ivin could not list this project's worktrees. Fix what git reports, then retry."); the branch picker shows its `ErrorMessage` with Retry above its footer and git's output under it in mono, as for a refused checkout.
- **Go to file:** ⌘P (`files.goToFile`) opens a `QuickPick` 40px from the top of the window, centred, 560px wide: the raised ground, a strong hairline, 10px corners and the overlay shadow, with no scrim. A 40px field row holds a faint 16px magnifier and 14px text, "Go to a file in <working folder>"; under a hairline, up to 50 files in 28px rows with 4px corners: a faint 14px file icon, the name with its matched letters in 600-weight accent, the folder in faint 12px mono cut with an ellipsis, and the git status letter in its colour at the right end. The letters typed match a file's name in order, the tightest and earliest runs first, then the files whose path holds them; with nothing typed, the first 50 files in path order. Up and Down move the highlight (the active wash), Enter or a click opens the file in the files card, which reveals it in the tree, and Escape closes it. A footer under a hairline says "↑↓ to move · ↩ to open · esc to close" on the left and the working folder's file count on the right, in faint 11px text. In place of the list: "Listing files…", "No file in the working folder matches “<text>”.", "No session on screen. Open one to go to its files.", a deleted working folder's sentence, or the `ErrorMessage` of a listing or an open that failed, with Retry.

### Composer
A raised 10px-corner surface with a strong hairline, docked at the bottom of the centred column. The text field sits flat inside it, with the faint placeholder "Ask, build, or paste an image…", and takes the focus when a session opens, unless the session waits on an approval or the keyboard moved the focus to its tab. When focused, the surface's border turns to the focus ring colour at 45% over the strong hairline. A draft, its text and its images, survives a session switch. Below the field: the session's run options on the left, as one ghost trigger (muted 12px 500-weight text and a chevron, 24px, 4px corners, the hover wash, the active wash while open) naming the model after the 14px mark of its harness, the effort and the permission mode, split by faint middle dots ("Sonnet 5.5 · High · Manual"; a model that takes no effort drops it). It opens a column menu: Model, Effort and Permissions side by side, with a check on each current value. The model column lists the latest models, then an "Older models" group; the effort column greys out the levels the chosen model does not take, and says so under the list when it takes none. Picking a model whose effort levels leave out the current one moves the effort to the closest lower level. While the agent works, a faint "Applies once the agent finishes this turn." row sits under the columns. Values show by the names the harness gives them, never by what the harness takes. The status shows only on the session mark, with a hidden label here for screen readers. On the right one icon action: Send (primary, arrow up, disabled while the field is empty), or Stop (secondary, filled square) while the session works and the field is empty. Under the surface, a faint status line carries the `composer.status` slot (usage) at its right end; the session's worktree, branch and PR checks join it when the server sends them. Before the first message in the checkout, two small tonal buttons (20px, 4px corners, the accent at 14%, 22% on hover, in accent text, as most sessions should start from a fresh default branch) follow the branch: `↓ N` with an arrow-down icon and mono figures, when the branch can fast-forward from `origin`, and "Switch to <default branch>" with a two-way arrow when the checkout is on another branch that no worktree holds. Local changes before a switch open the "Uncommitted changes" dialog (Cancel, Commit & switch with a message field, Stash & switch); a refused switch or pull opens a dialog with git's output in a code block and "Stash & pull" or "Stash & switch" when local changes are the cause. Plugins can dock a sheet on its top edge through the `composer.above` slot. While messages sent during a turn wait for the agent to read them, an action sheet docks there with a muted clock icon: "Sent to the agent" ("3 messages sent to the agent"), each message in the user's message bubble, 8px apart, its 13px text cut to one line, then the faint hint "Read once the agent's current tool call or turn ends. Stop puts it back here." beside a ghost "Send now" (tooltip with its key, ⌘⌥↵ by default), which stops the turn and sends them as the next one; when that fails, an `ErrorMessage` with Retry sits right under the sheet. Under the approval sheet, the dashed amber edge runs between the two sheets instead of along the composer. A stop puts the messages the agent never read back in the field, once each: with their images, which take the next numbers of the session, and their markers renumbered to match. Text the user removes stays removed when they leave the tab and come back. When the first message after a change of run options fails, a danger action sheet docks on the surface's top edge (its border and the surface's top edge red at 40%): "The agent did not start with <new values>.", a faint "Your message is back in the field." beside a ghost "Pick another" that opens the run options menu on the changed value, and a primary "Back to <previous value>" ("Go back" when several changed); the values that changed show red on the trigger, and the message returns to the empty field.

### Images
An image pasted (⌘V) or dropped into the composer takes the next number of the session and goes in the text, at the caret or where it is dropped, as its marker: an 18px pill with 4px corners, in a 9% text wash with a hairline ring, holding a 16px thumbnail with 3px corners and `#N` in 12px medium tabular figures. The marker is one character for the caret and Backspace, and it opens the full-screen view on click; its hover (accent at 18%, a 40% accent ring) also shows a 240px preview card above it, with the image and a faint "Image #N". The agent reads it as `[Image #N]`, with the image right after. Above the text, the draft's images line up as 56px thumbnails with 10px corners, each with a 20px round × badge on its top-right corner (the text at 30% over the raised ground, ringed in the raised colour) that removes the image and its marker. Hovering a thumbnail lights up its marker, and the reverse. A file that is not a PNG, JPEG, GIF or WebP, or above the agent's limit, adds nothing and shows a red message above the composer that names it. While files are dragged over it, the composer's border turns dashed accent over a 6% accent wash.

Every image takes its own number, in the order pasted, even when several are read at once. An image that finishes reading after the user left the tab goes into that session's draft with its marker at the end of the text.

A sent message shows its images as 72px thumbnails above its text, 12px from the bubble's top and left edges and 10px above the text, each with its `#N` in a dark label on the bottom-left corner, and its markers in the text. Thumbnails crop to the image's top-left corner, where a screenshot starts, and load when their row scrolls into view.

A thumbnail or a marker opens the full-screen view over the whole window, on the deep ground: a 48px head that drags the window, its row lined up with the sidebar card's top row and starting after the traffic-light space, with "Image #N · i of n" and the message it came from in faint text (or "<file> · Not sent yet" for the draft's images), the image fitted in the middle with ghost ← and → buttons on its sides, and a strip of 64×44 thumbnails along the bottom, the current one ringed in accent, with a hairline between the images of different messages. ← and → move through the session's images in transcript order, or the draft's; Escape closes it and puts the focus back where it was.

### Branch Picker
The branch on the composer's status line is a ghost trigger (muted mono text, a branch icon and a chevron) that opens a composer menu. Rows are mono: local branches at full colour, then `origin/<name>` rows in muted text with a faint `origin/` prefix, an icon and no mark. A local branch held by another worktree, or by the checkout, takes a yew icon and a faint pill ("in worktree", "in checkout"); the current branch takes a yew check. While `origin` is first fetched, a faint "Fetching remote branches…" row with a spinner holds the remote rows' place; a later fetch shows a "Fetching" spinner in the search field, or in a faint row under the list when the menu has no search field. A footer says what picking the highlighted branch does ("Moves this session to the worktree .worktrees/feat-login.") beside the key hints. A checkout git refuses shows the UI's message and git's output in mono inside a danger block, and the menu stays open. The trigger is disabled while the agent runs a turn.

When the session's worktree was deleted, the composer's surface is replaced by a raised panel of the same shape with 16px padding: "Where should the agent continue?" in 16px semibold, a muted sentence saying the conversation is kept, the deleted path in faint mono, then one choice per row (Current checkout, New worktree, then the project's other worktrees under a faint "Existing worktrees" caption). The choices scroll inside the panel past 360px, and less when the window is short, so the button stays on screen above the transcript's 240px. A choice row is an icon, a 500-weight label (mono for a branch) and a muted description; the chosen row takes the active wash and a strong hairline. Arrow keys move the choice and Enter confirms it, as does the primary button at the bottom right ("Continue here", or "Create and continue" for a new worktree). The status line and the sidebar row show the old branch struck through, followed by "deleted", in faint text.

### Action Sheet
A raised panel docked on the composer's top edge: 10px top corners, no bottom border, and the composer's top corners go square so the two read as one surface. It slides up 8px and fades in over 180ms (`--iv-duration-base`) on `--iv-ease-out`. A head row carries an optional muted 16px icon and a 500-weight title. A detail, such as the command to approve, sits under it in a code block: 12px mono on the subtle ground, a hairline and 6px corners, 8px by 12px of padding and 12px above the content, its own line breaks kept and cut to three lines with an ellipsis, in full on hover. A faint caption hint sits below the content. In the attention tone the outline turns to the dashed amber outline, the composer's top edge turns dashed amber with it, and the title and its icon turn amber. The title row can carry an aside on its right, such as `Steps`. A footer can close the sheet: key hints on the left, the actions on the right.

The question sheet is an attention action sheet titled "The agent asks" after a filled question icon, with the questions' `Steps` on the right when there are several. It shows one question at a time: its text, 4px in like the title, then 12px below, "Choose one or more" in faint 12px text when several answers are allowed, 4px above a `ChoiceList` that takes the focus unless the composer holds a draft. Its footer reads "↑↓ Navigate · Space Select · Esc Decline", with a ghost "Decline" on the right; a question with several answers adds "N chosen" and a primary "Continue", "Send" on the last question, 12px apart. Picking a single choice goes to the next question; confirming the last one sends the answers, or goes to the first question left unanswered. What the user picked survives a session switch. Once answered, the transcript shows "Asked N questions" after the question icon, then each question's header in muted text beside its answer, the labels joined by commas; declined, it shows "Declined the agent's questions" after an x; left unanswered, because its turn or run ended first, it shows "Not answered:" after a muted circle-alert, each question on its own line after a "•", and the faint 12px line "The agent stopped while it waited, so it can no longer take your answers." The tool call that asked them does not show.

### Option List
A keyboard-first single choice inside a sheet: 36px options with 6px corners, 4px apart, body text with an optional faint caption hint on the right (a key such as "Esc"). The chosen option takes the active wash; the others take the hover wash on hover. Arrow keys move the choice, Enter submits it, Escape takes the escape action, and a click submits directly when asked. The approval sheet uses it for Allow / Deny, under its title "Approval needed" after a filled exclamation icon, as the question sheet's title follows a filled question icon, and the command in the detail code block.

### Choice List
The options of one of the agent's questions: 36px rows with 6px corners, 4px apart, each a 16px mark, the 500-weight label, a muted 12px description that wraps onto more lines rather than being cut, and its number as a faint hint on the right; the mark and the hint stay on the first line. A single choice takes radio buttons, several answers take check boxes with 4px corners; a picked mark fills with the accent. The row under the cursor takes the active wash. ↑↓ move the cursor, Space picks or ticks, a number picks or ticks its row, Enter confirms, ←→ go to the previous or the next list, Escape takes the escape action; from the empty composer only the arrows, Enter and Escape reach it. A pick by click or number confirms a single choice. A last "Other" row answers in the user's own words: picking it opens a small field in the row, Enter confirms the text and Escape closes the field.

### Steps
A row of steps in a sheet's title row: per step a 16px numbered circle and its name in 12px faint text, joined by 16px hairlines. The current step's circle and number turn amber and its name takes the text colour at 500 weight; a step done shows a check in the accent on an accent wash. A click goes to a step; the keyboard moves with the arrows of the list the steps head.

### Overlays
Key hints are one component (`KeyHints`) wherever a surface lists its keys, in a sheet's footer, a menu's footer, the quick pick and the archived list: each key in muted 500-weight text, its action in faint 12px text. A key is a symbol or a short name (`↑↓`, `←↑↓→`, `↵`, `Esc`, `Space`), its action one capitalised word (`Move`, `Pick`, `Open`, `Close`, `Deny`).

Menus have 10px corners, 4px padding and 28px items with 4px corners; the highlighted item takes the active wash and destructive items are red. A composer menu (the working folder and branch menus, and every menu added there) is 360px wide and opens above its button, on the button's left edge, at most 360px high; with too little room above, its list shrinks and scrolls rather than open below. A list longer than ten rows (what that height holds beside a footer) gets a search field at the top, focused on open, that filters it; groups are split by a hairline and headed by a faint caption. A label too long for the row is cut with an ellipsis and shown in full on hover. A column menu is 560px wide and opens the same way: its columns sit side by side, split by hairlines, each under a sticky faint caption and scrolling on its own past 236px; a wide column takes half as much room again. Up and Down move inside a column, Left and Right to the same row in the next column, skipping greyed-out items; picking keeps it open. A footer describes the highlighted item, or says what a pick does, beside the key hints. Tooltips are 12px text with 4px corners, at most 420px wide; a mono tooltip (a command, a path) wraps its text, with a faint caption label above it. A tooltip's text stops at three lines, six for a mono one, with an ellipsis. Dialogs are at most 420px wide, with 20px padding, a 16px semibold title, a muted description and right-aligned actions. A dialog is never taller than the window less 32px: its body (a list of files, git's output) scrolls between the description and the actions, which stay in view, and long names wrap. All three fade and scale from 0.97 (120ms for menus and tooltips, 180ms for dialogs) on `cubic-bezier(0.22, 1, 0.36, 1)`, and reduced motion removes it.

### Notification
A temporary message for what has no place on screen: a command run from a keybinding that failed with its target hidden, or something a plugin tells the user. A pill with a 22px radius (`--iv-radius-notification`), a 1px border tinted 32% with the kind's colour (danger for an error, attention for a warning, muted for info, accent for a success), a 16px icon of that colour, the message in 13px text that wraps to as many lines as it needs, an optional ghost action (Retry) and a ghost close button. Icon, action and close sit on the first line. It stacks centred on the session's chat, 24px above the composer (the composer's own bottom margin): the newest in front, the older ones folded behind it, 14px apart and 5% smaller each, up to five. The pointer or the focus on the stack spreads it into a list and holds every timer. It goes away after 6s, slides up 20px over 350ms while it fades in over 180ms, and fades out over 180ms. A raised ground with a 12% shadow, no overlay shadow. A failure is announced at once, the other kinds politely; F6 puts the focus on the stack, Tab walks the notifications and Escape closes the one that has the focus.

Screen readers also hear two things through polite live regions, with nothing drawn on screen. When a turn ends in the session on screen: the start of the agent's last message of that turn, cut at a word near 150 characters, its markdown marks dropped; never the text while it streams, and nothing when a session opens or comes on screen. When a session of the selected project asks for an approval: "<title> needs your approval: <the first line of the command>", once per approval; the approvals already waiting when a project comes on screen are not announced.

### Disclosure and Code
A path in an agent's answer opens its file beside the chat, as a link does: inline code whose whole text names a file keeps the look of inline code and takes a dotted underline and the pointer on hover, and Tab and Enter reach and open it. Inline code that is a domain (`github.com/…`) looks the same and opens the web page in the browser. The file a Read, Edit, Write or MultiEdit row names (`FilePath`) keeps the row's muted mono text, and takes the text colour and a dotted underline on hover; a click opens the file and leaves the row as it is.

Disclosures use a muted summary with a chevron that rotates 90 degrees when open; a sidebar section or panel head ("Inactive sessions", "Working") puts it at the right end, so its label lines up with the group labels under it. A folded disclosure's content is not in the page until it is unfolded. A code block shows at most 2,000 lines, then a faint "Showing the first 2,000 of N lines."; Copy still copies all of it.

A turn's work sits under one faint line, from the agent's first item to its last tool call; while the turn runs, the agent's text after that call is part of it too. The line opens on a 14px icon at the column's edge, and the turn's text starts 22px in. While the agent works, the icon is a spinner, the line reads "Working for 12s" with a ticking clock, and "· N failed" in red once a call fails; the turn stays unfolded, so the timeline grows under it. Once the turn ends, the icon tells how (a check when it answered, a square when it was stopped, a red alert when it failed), the line reads "Worked for 1m 42s · 12 tool calls · 1 failed" and folds, so only the user's message and the answer (the agent's text after its last tool call) stay in view. A turn that ends without an answer stays unfolded and reads "Stopped after …" or "Failed after …". On hover or focus, a chevron takes the icon's place; while the turn is open it stays in place of a check, but the spinner, the square and the alert stay in view. A hairline runs to the line's right.

Unfolded, the turn is a timeline: each of the agent's sentences heads one step, marked by a 7px ring centred under the turn line's icon, on a vertical line that starts just below that icon and joins the rings; the ring turns red when one of the step's calls failed, and the ring of the step that runs is yew and pulses. Calls made before any sentence form a first step with no sentence. While the turn runs, the agent's last sentence heads a step even before it has calls: the sentence alone, with no summary, and it stays in place when its first call comes. Once the turn ends, its text after the last tool call leaves the timeline and becomes the answer as the turn folds. The sentence is in the prose colour and never cut. Under it, one faint summary lists the step's calls in the past tense, joined by "·": "Ran 4 commands · read 1 file · 1 failed" (ran a command, read a file, edited a file, searched, used a skill, ran an agent, used a tool). A click or Enter folds or unfolds the step's calls; over the summary its stack icon turns into a chevron, which stays while the step is open; while one of the step's calls runs, the icon is a spinner, which stays in view until hovered. The open calls are indented under the summary, each on a branch drawn from under its icon, with 3px corners, fainter than the timeline's line. While the turn runs, only its last step is open, and a step folds to its summary when the next one starts; once it ends, its steps are open when the turn has 8 tool calls or fewer, folded above that. A folded step still shows its failed calls and its subagent calls. Each ring sits 5px below the line that ends above it and 5px above the line that starts under it.

A steer heads its own step, at the point in the timeline where the agent read it: the user's bubble at the size of a step (13px text, 4px by 10px padding, as wide as its text), with the agent's next sentence under it. Its ring takes the bubble colour inside a ring of the text at 40%, unless it is the step that runs. The turn keeps one line, one clock and one count of tool calls across its steers.

While the turn runs, its timeline shows only its last 3 steps. Above them, one faint line reads "10 earlier steps", and "· 2 failed" in red when calls in those steps failed; the steps it hides show nothing, not even their failed or subagent calls. On the timeline, three 2px dots, 5px apart and centred on that line's label, stand in for the vertical line, with no line around them, as far from the turn line's spinner as from the next ring. The line is a button styled like a step's summary, with a chevron pointing right on hover or focus. A click or Enter unfolds the hidden steps under the line, which then reads "Hide 10 earlier steps · 2 failed" with the chevron pointing up, and the dots stay as they are; steps that leave the last 3 while it is unfolded stay shown until the user folds it again. While the turn runs, an open step's calls stop at 8 rows and scroll inside, under a short fade at the top: the list follows the newest call, keeps its place once the user scrolls up in it, and follows again once they scroll back to the bottom; past its end, the wheel scrolls the transcript. Once the turn ends, every step and every call shows again under the rules above.

The turn line, each summary and the earlier steps line are buttons with the focus ring, and what is folded survives a session switch. Unfolding or folding never moves the view.

A tool call is one row with no chevron: the icon of what it does (terminal for a command, file for a read, pencil for an edit, magnifier for a search, sparkle for a skill, robot for a subagent, a wrench otherwise), its name and its mono argument; a spinner while it runs, a red "failed" when it fails, nothing once it succeeds. Over it, or while open, its argument brightens to show it opens; its input and output open under it. A skill call reads "/name" and its arguments, and opens only when it failed, since its output only repeats the name. Thinking is not shown, and an approval leaves a trace in the transcript only when denied, "Denied:" and the command on one muted line, or when left unanswered: "Not answered:" and the command after a muted circle-alert, then the faint line "The agent stopped while it waited, so it can no longer take your answer." Its tool call then shows "failed". Code blocks use the deep ground, mono and 6px corners, and scroll past 240px. A code block, in a tool call or in a Markdown answer, shows a small ghost Copy button in its top right corner on hover or focus; it turns to a check reading "Copied" for 1.5s after a click.

### Background tasks
While a session has tasks running, a line sits under the transcript's last turn in the turn line's shape: a 7px yew dot that pulses (a chevron on hover or focus), "3 tasks in background" and a hairline. It starts folded; a click or Enter lists the tasks, scrolling them into view, one 28px row each with 6px corners: its icon (a robot for a subagent, a terminal for a command), its name, a small "Details" (subagent) or "Output" (command) pill in 12px text on a 16px line, that shows on hover or focus and takes the pointer, then at the right a faint tabular summary ("8 tool calls · 1 failed", "running 1m 40s") and a chevron. A click on the row unfolds it in place under the row, indented 22px: a subagent's last 3 steps, drawn as a running turn's timeline (with its "N earlier steps" line), or a command's last 5 lines in a code block. The line, the rows and what is unfolded survive a session switch. It stays under a turn the agent starts while tasks still run, and goes with the last task.

The pill opens the task's sheet, which floats over the bottom of the transcript on the composer's top edge, at the width of the action sheet: a raised panel with 10px top corners and no bottom border, the sheets and the composer under it going square at the top, so they read as one surface. It is 340px tall by default and at most the window less 280px; its top edge resizes it by drag or arrow keys (a green line that stops 10px short of the corners, with rounded ends), without moving the transcript behind it, and the size is kept between launches. Its head is the files card's row of tabs, with the same sizes and colours: one pill tab for each running task and for the one shown, 12px on both sides, an icon and the name, with the task's summary and a 12px close button at the right. A tab switches the task. Under it, a subagent's whole run, as a running turn draws it: "Working for 3m 12s" (or "Worked for") on the turn line, then every step open with its sentence, its calls and their output, following the run live; a command's whole output in a code block with no height limit, read again every second while it runs, or "No output yet". Escape, the close button and a click anywhere outside the sheet close it, except on another task's pill, which switches the sheet. Escape closes the sheet before it interrupts the agent.

A subagent's steps and a task never show among the turns: they show here and under the task's row only. Stopping the agent (Interrupt, or closing the tab with stopping on close) stops the tasks, and both ask first, as for a working agent.

### Files card
Each open file has a pill tab in the card's top row, in the order opened, 2px apart: a 26px tab with 6px corners holding the file's 14px icon from the file icon theme, the one the Files tab shows (with no icon theme, a faint 14px file or diff icon), the file's name in 12px medium (cut with an ellipsis past 200px, its path on hover) and an 18px close button with a faint ×. A hover takes the hover wash; the selected tab takes the active wash, the text colour and a muted icon. A click selects a tab, Left and Right move between them, a middle click or the × closes one, and Close file (⇧⌘W; ⌘W closes the session's tab) closes the selected one. As in the tab bar, the × is for the mouse, and the × and the separator after Session are hidden from screen readers; file tabs do not reorder. Closing the selected file selects the next one, else the previous, and a focused close hands the focus to the newly selected tab. The row ends on the mode button, outside the tabs' scroll: beside the chat, a 24px ghost icon button with the arrows-out icon ("Full width"); in full width, a small ghost button with the split icon and "Beside chat". Toggle full width (⇧⌘Enter) does the same, and Next and Previous tab of the files card (⌥⌘→, ⌥⌘←) go round the row, through Session in full width. Going back beside the chat from Session selects the file that was selected last. A close or a mode switch that fails shows its `ErrorMessage` under the row, above the chat when Session is selected, with Retry. The open files, the selected one, the mode and a selected Session tab survive a session switch and a relaunch, each tab keeping its own, and each file keeps its scroll position while ivin runs. A file link or a path in an agent's answer opens its file here like a click in the tree; a link that names lines opens the file centred on them, selected in the same 22% yew wash. An open that fails shows its `ErrorMessage` under the answer, with Retry.

A file outside the working folder opens read-only, under a 32px bar on the raised ground with no hairline: a muted 14px lock, "<name> is outside the working folder, so it cannot be edited." in 12px text, and a small ghost "Show in Finder" ("Show in File Explorer" on Windows, "Show in Folder" on Linux), which opens the system's file manager on it. Typing in it changes nothing, and it does not follow the disk: showing it again reads it again.

An image (png, jpg, gif, webp, avif, bmp, ico, svg) shows as an image, on a 32px head over a hairline: the path in 12px mono, cut with an ellipsis, the size in faint 11px tabular figures ("1024 × 1024 · 312 KB"), and a small ghost "Actual size" (then "Fit"). Under it, the image is centred on a 16px checkerboard of the text at 6% over the card ground, with 24px of room around it, shrunk to fit and never enlarged; at actual size it scrolls. An SVG's head ends on a `Segmented` "Image" and "Source", and its source opens in the code view, editable as any text; it shows through an `<img>`, never in the page itself. An image over 10 MB says "<name> is <size>, over the 10 MB ivin shows, so it is not shown.", and one that does not decode "<name> cannot be shown: its data is damaged or in a format ivin cannot read.", both in muted text in the middle of the card. An image follows the disk like a text.

The selected file shows in an editable code view: 12px mono on 20px lines in the prose colour, on the card ground, with faint tabular line numbers on an opaque gutter that stays put while long lines scroll sideways under it, 8px of room above the first line and 40px below the last. Code keeps its lines whole and scrolls sideways; Markdown wraps its lines to the card's width. The focused view marks the cursor's line with the hover wash and selects text in a 22% yew wash. Syntax colours follow the project hues of the theme: keywords hue 3, strings hue 0, numbers and constants hue 4, types hue 5, functions hue 1, tags and headings hue 2, comments faint and italic (`--iv-syntax-*`). A file over 2 MB says "<name> is <size>, over the 2 MB ivin shows, so it is not shown.", a binary file "<name> is a binary file, so it is not shown.", both in muted text in the middle of the card; a file that is gone or unreadable shows its `ErrorMessage` there, with Retry. While a file loads, the card stays blank.

The code view edits with VS Code's keys: ⌥↑ and ⌥↓ move the line, ⇧⌥↑ and ⇧⌥↓ copy it, ⌘/ comments it out in the file's language, ⌘D selects the word and then each next occurrence with a cursor of its own, ⌥-click adds a cursor, ⌘Z and ⇧⌘Z undo and redo, Tab indents, Ctrl+G goes to a line and ⌘F searches the file. Escape stays in the view, so it never stops the agent from there. A file is written back with the line break most of its lines end with. Search and Go to line open a panel across the top of the view, on the card ground over a hairline: 24px mono fields on the raised ground with a strong hairline, ghost 12px buttons, muted labels, a faint × at the right. A search match is washed in yew at 14% under a 45% yew outline, the selected one at 32%, and the other copies of the selected word at 12%. Save file (⌘S, `file.save`) writes the selected file.

An edited file's tab shows an 8px muted dot in place of its close button, and the × comes back over the dot while the tab is hovered or holds the focus; typing the file back to what is saved drops the dot. The edits survive a session switch. Closing an edited file asks in a dialog, "Close <name> without saving?", with Cancel, a danger "Close without saving" and a primary Save, which writes the file and then closes it. Closing the session's tab with edited files asks the same in the tab bar's dialog, "Close “<title>” without saving its files?", naming the files, and saying that the agent stops too when closing the tab stops it. Archiving a session (menu or keybinding), deleting it, or closing its project asks the same in a `Dialog` when one of its files has unsaved edits: "Archive “<title>”?", one sentence ("Archiving this session will stop the working agent and lose the unsaved edits to these files:", without the agent when it is idle; Delete and Close project say the same), then the files in faint 11px mono, each after a small danger dot, then Cancel, focused first, and a danger "Archive and lose edits" ("Stop and archive" when the agent is running, "Delete and lose edits", "Close project and lose edits"). A project's files carry their session's title when several sessions have edits. Confirming drops the edits once the action succeeded; Cancel changes nothing.

When the file on disk is no longer the one the edits were typed over, found by a save or by showing the file again, a bar across the top of the view says "<name> changed on disk while you had unsaved edits." ("was deleted on disk" when it is gone, the edits staying on screen) on the danger wash, under a red hairline at 40%, with a red alert icon, then a ghost "Reload from disk", which drops the edits, and a small secondary "Overwrite", which writes them over the file. ⌘S does nothing while it shows. A shown file follows the disk: with no unsaved edits, the new text replaces it in place and the cursor and scroll stay; with unsaved edits, the bar shows as soon as the change lands. A file git ignores is not followed. A save that fails shows its `ErrorMessage` in the same place, over a hairline, naming the file and what to do, and keeps the edits and the dot, with Retry when a second try can work.

A diff's tab shows the diff icon in place of the file icon and a faint 11px "diff" after the name, "committed" for what the branch's commits changed; a file, its uncommitted diff and its committed diff are three tabs. The diff view opens on a 32px head over a hairline: the path in 12px mono, cut with an ellipsis, the "+N −N" counts in 11px tabular mono in the added and deleted colours, and a small ghost Open file button (absent for a deleted file), which opens the file in its own tab. Under it, the diff is unified and read-only, in the code view's type and syntax colours: two faint gutters of tabular line numbers at 70% opacity, the old file's and the new file's, then a 16px column with "+" in the added colour or "−" in the deleted colour. An added line, gutters included, takes the added colour at 10% over the card ground, a deleted line the deleted colour at 10%; when a deleted line is followed by its added replacement, the part of each that changed is washed at 22% with 2px corners. Each hunk opens on a 28px band between hairlines, on the subtle ground, with git's `@@ -a,b +c,d @@` header in faint 11px mono. The diff follows the disk while it is shown. In place of the diff, in muted text in the middle of the card: "<name> has no uncommitted changes." ("The branch's commits did not change <name>." for a committed diff; "This repository has no origin remote, so the branch's commits cannot be shown.", "Git does not know origin's default branch, so the branch's commits cannot be shown. Run git remote set-head origin --auto." or "The branch shares no commit with origin's default branch, so its commits cannot be shown." when it has no base), "<name> is a binary file, so its diff is not shown.", "The diff of <name> is over the 4 MB ivin shows, so it is not shown.", or "This working folder is not in a git repository, so it has no diff to show."; a diff git refuses shows its `ErrorMessage` with Retry and git's output under it.

### Settings page
The settings take the whole window, in place of the sidebar card and the main area, which stay as they were behind it. Settings (⌘,, `settings.open`) or the gear in the card's top row opens it, on the section last shown; Escape (`settings.close`) or the back arrow closes it, and the focus goes back where it was.

The sidebar card keeps its frame and its 40px top row, empty. Under it a 36px head holds a ghost back arrow ("Back to sessions") and "Settings" in 14px semibold, then one list row per section, with a faint 14px icon and the section's title: Tabs (app-window), Worktrees (worktree), Files (folder), Sidebar (panel-left), Agents (robot), Updates (download), Command line (terminal). Up and Down move between sections and show each one at once. Under a hairline at the card's foot, an "Open settings.json" row with the brackets-curly icon opens the file in the system's app for JSON files; its tooltip gives the path, and a failure to open shows its `ErrorMessage` above it, with Retry. Under it, "ivin <version>" in faint 11px text, the server's version, while the server answers.

The main area keeps an empty 40px draggable bar, then the selected section in a centred column at most 720px wide, with 32px side padding: its title in 16px semibold, a muted one-line description, then its settings between hairlines, each with 16px of padding above and below: the label in 500 weight, a muted 12px description, the setting's key in faint 11px mono, and the control on the right (a `Switch` for a boolean, a `Select` for a setting with fixed values, such as the sidebar's Rail or Strip, and for a count, such as the minutes before an idle agent stops, a short text field with its unit beside it that saves on Enter or when it loses focus, shows an inline alert and saves nothing on a value that is not a whole number of 0 or more, and goes back to the saved value on Escape). A change is written at once, and a change made in the file or with `ivin settings set` shows on the control as it happens. A failed write shows its `ErrorMessage` under the setting's description, with Retry, and the control keeps the user's choice. A `settings.json` that ivin cannot read puts a danger block above the title: the problem ("~/.ivin/settings.json is not valid JSON."), a muted "Fix the file and this page updates as soon as it is valid. Until then ivin uses the settings below, the file's last valid ones.", and a small "Open settings.json" button; the controls show those settings and are disabled until the file is fixed.

The Command line section has one row in the same layout: "`ivin` in your shell", a muted description, then its state, and on the right a secondary Install button, or a ghost Reinstall once installed. The state reads "Not installed. Your agents can run it; your shell cannot.", "Installing…", or a muted check with "Installed at" and the link's path in mono; under it, when the link's folder is not on the shell's PATH, "<folder> is not on your shell's PATH: add it, then open a new terminal." A failed install shows its `ErrorMessage` under the state, naming each folder and why, or the `ivin` already there that is not ivin's, with Retry; a status ivin could not read says "ivin could not check whether the command is installed.", with Retry. The `cli.installInShell` command opens the page on this section and installs.

### Pending designs
Decided but not built, because the data they need does not exist yet. Build them this way when it arrives.
- **Letter project icons:** lettered project icons in place of the pixel creatures, chosen on the settings page.
- **Plugin settings sections:** the `settings.section` slot, one section per plugin in the settings sidebar, after the built-in ones.
- **"Allow <rule> for this session":** a third approval option, waiting for an approval answer richer than allow or deny.
- **PR icon with checks colour:** a pull-request icon on a session whose colour follows its checks.

## Do's and Don'ts

### Do:
- **Do** take every colour, size, radius and duration from a `--iv-` token, so a theme file can override it. A harness mark's brand colour and a file icon theme's icons are the only literal colours.
- **Do** keep yew green for focus, selection, the primary action and "working", and use at most one primary button per surface.
- **Do** keep amber for "waiting for you" and approvals, and cursor red for errors and failures, through the `--iv-status-*` tokens.
- **Do** mark anything the user must answer with the dashed `--iv-attention-outline`, and only that.
- **Do** build plugin UI only from `@ivin/plugin-api` components, with layout through `Stack` and `Block`, and dock plugin prompts on the composer through `composer.above`.
- **Do** draw icons through `Icon` by name, in Phosphor regular weight, the question icon aside.
- **Do** use mono for code, commands and file paths, and tabular figures for times, counts and costs.
- **Do** keep transcript rows flat and cheap: a block, text, a disclosure, a code block.

### Don't:
- **Don't** put a shadow on anything that does not float above the window, the sidebar card included.
- **Don't** put the agent's answers in a bubble: only the user's message is one.
- **Don't** use dense dashboards, IDE chrome or decoration.
- **Don't** add inline styles to screens or plugins, or import a UI library or an icon set into a plugin.
- **Don't** add a font size, weight or radius outside the scales above.
- **Don't** use red or amber for emphasis or decoration, or project hues for anything but project identity.
