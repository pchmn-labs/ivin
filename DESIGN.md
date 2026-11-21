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
    lineHeight: "22px"
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
- Every value is a `--iv-` token a theme file can override; a harness mark's brand colour is the one exception.

## Colors

The palette is green-tinted neutrals, one yew-green accent, an amber and a cursor red signal, six project hues and the harness marks' brand colours (Claude's orange). Each theme colour has a light-theme counterpart (the `-light` keys).

### Primary
- **Yew Green** (`--iv-accent`): the primary button, the selected tab underline, the focus ring, the caret, links, text selection (32% mix), the connected dot, the "working" status mark and the working ring on the session mark. In light it darkens to a deep forest green so white text on it stays legible.
- **Yew Hover** (`--iv-accent-hover`): hover and press on the primary button.
- **Yew Contrast** (`--iv-accent-contrast`): text on a yew fill.
- **Bubble** (`--iv-bubble`): the user's message. Yew mixed into the raised ground (14% in dark, 16% in light), so the user's own words read as theirs without a second accent.

### Secondary
- **Amber** (`--iv-attention`): the "waiting for you" status, the "Needs you" group label and count, the project rail badge and the approval sheet title. An approval is a question, not a fault, so it does not take the red. In light it deepens to a dark ochre so the badge's card-coloured count stays legible.
- **Amber Wash / Hover** (`--iv-attention-subtle`, `--iv-attention-hover`): amber at 8% and 13%, the fill of a waiting row that carries controls under it (a Working panel card), at rest and on hover.
- **Amber Outline** (`--iv-attention-outline`): amber at 60%, used only as a dashed 1px line around something the user must answer.
- **Cursor Red** (`--iv-danger`): the "failed" status, errors, failed tool calls, the failed connection dot and destructive menu items. Taken from the red terminal cursor in the app icon.
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

### Named Rules
**The One Accent Rule.** Yew green marks focus, selection, the primary action and "working". It never decorates.

**The Amber Asks, Red Fails Rule.** Amber marks only what needs the user (waiting, an approval); cursor red marks only what went wrong (error, failure). A status colour goes through `--iv-status-working`, `--iv-status-waiting`, `--iv-status-idle` or `--iv-status-failed`, never a raw colour.

**The Token-Only Rule.** No colour, font or size outside the `--iv-` tokens. Derived tints use `color-mix()` on a token (accent blocks at 8% fill and 40% border, the bubble at 14% or 16%, the checkout buttons at 14% and 22% on hover, the amber wash at 8% and 13%, the amber outline at 60%). The one exception is a harness mark's brand colour, which belongs to the harness, not the theme.

## Typography

**Body Font:** the system UI font (`-apple-system`, SF Pro Text, `system-ui`, Segoe UI)
**Mono Font:** `ui-monospace` (SF Mono, Menlo)

**Character:** the platform's own UI type, so ivin reads like a native desktop tool. Mono marks anything the user could type or paste: code, commands, file paths, the command an approval asks about.

### Hierarchy
- **Headline** (600, 20px/28px): level-1 headings inside Markdown answers.
- **Title Large** (600, 16px/24px): dialog titles and level-2 Markdown headings.
- **Title** (600, 14px/20px): the project name at the head of the session list and level-3/4 Markdown headings.
- **Body** (400, 13px/20px): the default for the whole app: row titles, options, controls, the composer.
- **Transcript Body** (400, 14px/22px): the user's message, the agent's text and the Markdown answer in the transcript.
- **Label** (500, 12px/16px): small buttons, field labels, tooltips, status labels, the session title in the main title bar, the composer's run options button, tool arguments and a failed tool's status.
- **Caption** (500, 11px/16px): the session group labels with their counts, the project badge (600), and key hints in the action sheet and option list.
- **Mono** (400, 12px/20px): code blocks, tool arguments, file paths and the approval detail (clamped to three lines). Inline code is 0.92em.
- **Transcript Mono** (400, 13px/20px): tool arguments, file paths, code blocks and other mono text in the transcript. Inline code stays 0.92em of its line.

Weights are 400, 500 and 600 only. Times, counts and costs use tabular figures.

### Named Rules
**The Native Type Rule.** Body copy is 13px system UI. Hierarchy comes from weight and muted tones, not size jumps. 20px is the largest size and appears only inside Markdown. The transcript is the one place set larger, for long answers: 14px text and 13px mono, and its 12px labels (the turn line, step summaries, "failed", "Denied:") move to 13px while 11px labels stay. The tokens are scoped to the transcript, so the same `Markdown` and `CodeBlock` keep 13px and 12px elsewhere.

## Layout

The window is a two-column grid. On the left, a floating sidebar card 300px wide by default (`--iv-card-width`), inset 8px from the top, bottom and left window edges. On the right, the main area on the forest ground. The card's right edge resizes it between 240px and 480px, by drag or by the arrow keys once focused; a double-click returns it to 300px, and the width is kept between launches. The sidebar toggle removes the card, and the main area then takes the full width. With no project open the window is a single centred column, with the connection dot in the bottom-left corner.

The card stacks a 40px draggable top row, a body, and the `sidebar.bottom` panel. The macOS traffic lights sit inset 15pt from the card's top-left corner, centred on the top row; the row holds 78px of space for them (`--iv-traffic-lights-width`), then the sidebar toggle, with back and forward 2px apart at the row's right end, all three ghost icon buttons. The body splits into a 44px project rail (`--iv-rail-width`, a hairline on its right) and the list column.

The rail holds one 32px button per open project, in order, 8px corners, with the project's 20px pixel creature; an amber count badge sits on its top-right corner for the sessions waiting on the user. Below, a spacer pushes the open-folder ghost icon button and the connection dot (faint, yew when connected, red when failed) to the bottom. The list column opens with a 36px head: the selected project's 16px creature, its name in 14px semibold, New session, and an ellipsis menu with Archived sessions (⇧⌘A) and Close project. Under it, the project's sessions that have an open tab, in tab order, under a "Sessions" caption label with its count; a session waiting on the user keeps its place and takes the waiting row style. A project with no tab says "No sessions in <name> yet. Start one with New session." Rows are 2px apart inside 8px side padding.

The `sidebar.bottom` panel spans the whole card width under the rail and the list column, above a hairline, and is absent when no contribution renders. It is at most 45% of the card tall by default and scrolls inside; its top edge resizes it by drag or arrow keys, up to 70% of the card, and a double-click returns it to the default. Its built-in contribution is the Working panel: a folding head "Working · N", with "· M need(s) you" in amber, that stays in view while its rows scroll, then "Needs you" and "Running" groups listing the sessions of every open project that wait for an approval or run, except the one on screen. Each row has the session mark, the title, the elapsed time in its status and, on a second line, the project's 12px creature and name; a waiting row adds the command it asks about (the first line, mono, truncated), shows the whole command in a mono tooltip titled "Approval needed" after a hover, and carries a small secondary Allow and a ghost Deny under it, inside its frame. A click on a row opens its session's tab, and the approval sheet then takes the keyboard focus.

The main area opens with a slim 40px draggable title bar (8px from the top) holding the selected project's tab bar (see Navigation); when the sidebar is closed the traffic-light space and the shell controls move into it. Below it come the transcript and the composer, which share a centred column at most 928px wide (`--iv-content-width`), with 24px side padding. Transcript items are separated by 8px of vertical padding, and the last one's text ends 40px above the composer. The list is virtualised, so a row's look must stay cheap.

The transcript opens on its end. When a message is sent, the transcript scrolls in 180ms on the ease-out curve (instantly with reduced motion) until that message sits at the top of the view, with empty room below it for the answer; the room shrinks as the answer grows, and once the answer fills the view, the transcript follows its end again. Scrolled up, the transcript stays put while the agent writes.

Spacing is a 4px grid (`--iv-space-1` to `--iv-space-10`). Layout gaps go through `Stack` at 0, 4, 8, 12, 16, 24 or 32px. Screens and plugins carry no inline styles: layout goes through `Stack`, `Block`, or a CSS file beside the screen.

## Elevation & Depth

The app is flat at rest. Depth comes from four ground tones and 1px hairlines. The sidebar card reads as floating because it is inset from the window edges, sits on its own card ground and carries a hairline; it casts no shadow. The action sheet docks onto the composer and shares its edge rather than rising above it. Only things that float above the window cast a shadow: menus, tooltips and dialogs. A dialog adds a dim backdrop (`--iv-backdrop`, set per theme) and a strong hairline.

### Shadow Vocabulary
- **Overlay** (`--iv-shadow-overlay`): menus, tooltips and dialogs. In dark, `0 8px 24px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3)`; in light, the same shape in a soft green-black.

A zero-blur `box-shadow` ring that stands in for a border (the selected rail button's and the selected tab's 1px hairline ring, the badge's 2px card-coloured ring, the idle status ring) is a line, not elevation.

### Named Rules
**The Overlays-Only Rule.** A shadow means "this floats above the window". Blocks, the sidebar card, the composer, the action sheet, rows and buttons never cast one.

## Shapes

Corners are gently rounded in three sizes: 4px (`sm`) for menu items, tooltips, inline code and the bubble's tail corner; 6px (`md`) for buttons, fields, rows, options, blocks and code blocks; 10px (`lg`) for the composer, the action sheet, menus, dialogs, and scrollbar thumbs. Large surfaces that frame the app take `--iv-radius-card` (10px): the sidebar card and the bubble. The user's bubble is rounded on three corners and keeps a 4px corner at the bottom right, toward the user's side.

Borders are 1px. The 2px lines are the selected tab underline and the tab drop line (`--iv-line-bold`). Status marks and overlays on the session mark are circles; the project badge is a pill. Project creatures are 8 by 8 pixel grids drawn with crisp edges, at 16px in the project column and 12px in a Working panel row.

### Named Rules
**The Dashed Amber Rule.** A dashed 1px line in `--iv-attention-outline` means "the user must answer". It goes around a waiting session row and the approval sheet, and nowhere else. A solid red line means an error, not a question.

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
| confirms an action that cannot be undone, or fills a short form before one | `Dialog` | `ActionSheet`, which only carries what the composer waits on: an approval, a failed relaunch |
| reads the full text of a cut label, a command or a path | `Tooltip` | a tooltip holding a button or a link |
| browses items to open or act on (sessions, archived sessions) | `ListRow`, inside a `ListSection` when the list is grouped | `OptionList`, which submits one choice |
| sees that an action failed | `ErrorMessage` under what failed, with Retry when retrying can work, and a `CodeBlock` when there is output to read (git's) | a danger `Block`, which is for an error in the transcript |
| reads code or a command's output | `CodeBlock`, inside a `Disclosure` when it is secondary, as tool output is | `Markdown`, which is for the agent's answer |
| sees a session's status | `SessionMark` | `StatusMark`, which shows no harness |

### Buttons
- **Shape:** 6px corners, a 1px border slot, 500 weight. Medium is 28px tall with 12px side padding; small is 24px tall with 8px padding and 12px text. Icon buttons are square.
- **Primary:** yew fill with yew-contrast text. One per surface: Send, Open folder.
- **Secondary (default):** raised ground, strong hairline, default text: the composer's Stop.
- **Ghost:** transparent and muted, for toolbar, shell and row actions, and New session.
- **Danger:** red wash and red text.
- **States:** hover changes fill only (yew hover on primary, hover wash elsewhere) over 120ms; press uses the active wash; disabled drops to 45% opacity (`--iv-opacity-disabled`, shared by fields, selects, menu items and options). Focus is the global 2px yew outline, 2px offset.

### Icons
Phosphor icons at regular weight, 16px by default and 14px inline with small text, drawn through `Icon` from a fixed list of names (plus, folder-open, send, square, check, x, chevrons, ellipsis, terminal, file, pencil, circle-alert, loader, copy, git-branch, brain, wrench, user, sparkles, arrows, arrow-down, arrows-left-right, panel-left, new-session, search, archive, trash, restore). A screen or plugin asks for a name, never imports an icon. The loader spins on `--iv-duration-spin` (900ms).

### Blocks
- **Use:** the box for a transcript item. 1px hairline, 6px corners, padding 8, 12 or 16px.
- **Tones:** plain (transparent); subtle (deep ground, the default); accent (yew at 8% fill and 40% border); danger (red wash and a 40% red border, for errors); bubble (the user's message, see below).
- **Bubble:** the user's message, full column width, no border, 10px by 12px padding, on the bubble colour, with the 10/10/4/10 corner shape. Claude's answer is never a bubble: it is plain Markdown with no speaker label.

### Inputs / Fields
- **Style:** raised ground, strong hairline, 6px corners, 28px tall. The text area grows with its content up to 240px. Placeholders are faint.
- **Focus:** the border turns to the focus ring colour.
- **Disabled:** 45% opacity (`--iv-opacity-disabled`). A select matches a field with a muted chevron.

### List Rows
- **Style:** 30px tall, 6px corners, 8px padding: a leading mark, a truncated title, then faint tabular metadata (relative time).
- **States:** hover wash; selected rows take the active wash and 500 weight; a row whose session waits on the user takes the dashed amber outline, inset by 1px; with controls under it, it also takes the amber wash (amber hover on hover). Row actions appear only on hover, focus or selection. Controls under a row (`below`) sit inside its frame, aligned with the title, and share its hover; a row's `tooltip` opens on its right.

### Session Mark
The signature of the session list: the 16px mark of the session's harness with a small circular overlay at its bottom-right, cut out from the card ground by a ring of the card colour. Working is a 10px yew ring with one open quarter, spinning on `--iv-duration-spin`. Waiting (approval needed) is an 11px amber disc with a "!". Failed is a 10px hollow red ring. Idle shows no overlay. The status always has a hidden label for screen readers.

### Status Mark
A labelled status for plugins. Working is a 6px yew dot pulsing over 1.6s (`--iv-duration-pulse`). Waiting is a larger 8px amber dot. Idle is a faint 1.5px ring. Failed is red. It always carries a label, visible or hidden.

### Navigation
- **Project rail:** a 44px column of 32px project buttons with 8px corners (`--iv-rail-button-size`), each showing the 20px creature. The selected button takes the raised background, a 1px hairline ring and a faint shadow (`--iv-shadow-raised`); an unselected one takes the hover wash on hover. The label and tooltip are the project's name, with " · N waiting for you" when sessions wait. The amber pill badge (`--iv-badge-size` tall, 11px semibold tabular count) sits on the button's top-right corner, ringed in the card colour. The open-folder ghost icon button and the connection dot close the rail.
- **List head:** 36px (`--iv-list-head-height`): creature, project name, New session, and a ghost ellipsis menu holding Archived sessions and Close project.
- **Archived sessions:** the list column's view of the project's archived sessions, in place of its sessions. Its head is a ghost back arrow, "Archived sessions" in 14px semibold and the faint count. Rows are session rows: the harness mark with no status, the title, the branch line, and the time since it was archived; Restore and Delete icon buttons appear on hover or focus. The focused row takes the active wash. Up and Down move between rows, Enter restores, ⌘⌫ deletes, Escape or the back arrow returns to the sessions. A faint footer under a hairline lists those keys. With none: "No archived sessions in <project>." and how to archive one.
- **Session actions:** a session row's ellipsis menu holds Rename, a separator, Archive and a red Delete…; an inactive session's row has the same Archive and Delete…, and a right click on a tab opens them too. Archiving a working or waiting session asks first ("Archive the session and stop its agent?", Cancel and a danger "Stop and archive"); every delete asks first, naming the session ("Delete “<title>”?", Cancel and a danger "Delete session"). A failed archive, restore or delete shows its message under the session's row.
- **Session groups:** caption labels in faint text with a tabular count; "Needs you" is in amber.
- **Tab bar:** in the 40px main title bar, the selected project's tabs followed by a ghost New session icon button (plus; it starts a session with the last run options of its project). A tab is `--iv-tab-height` (30px) tall with `--iv-radius-tab` (8px) corners, `--iv-tab-width` (240px) wide whatever its title, shrinking equally with the room left down to `--iv-tab-min-width` (180px) before the bar scrolls, 4px apart, its title cut with an ellipsis. It shows the session mark, then the title in muted 500-weight small text. The selected tab takes the raised background with a 1px hairline ring and a main-colour title; an unselected tab takes the hover wash on hover. A 20px close button (14px x) appears only on hover or keyboard focus; the title gives it room, the tab keeps its width. A middle click also closes a tab. The bar scrolls sideways with no visible scrollbar. Tabs reorder by drag, with a 2px yew drop line; Left, Right, Home and End move between tabs. Unselected tabs have no separators between them.
- **Tabs (component):** the underlined tabs for inside a panel: 32px tall, muted 500-weight labels, a 2px yew underline on the active tab, over a hairline. The tab bar above does not use it.

### Composer
A raised 10px-corner surface with a strong hairline, docked at the bottom of the centred column. The text field sits flat inside it, and the whole surface takes the focus ring colour when focused. A draft, its text and its images, survives a session switch. Below the field: the session's run options on the left, as one ghost trigger (muted 12px 500-weight text and a chevron, 24px, 4px corners, the hover wash, the active wash while open) naming the model after the 14px mark of its harness, the effort and the permission mode, split by faint middle dots ("Sonnet 5.5 · High · Manual"; a model that takes no effort drops it). It opens a column menu: Model, Effort and Permissions side by side, with a check on each current value. The model column lists the latest models, then an "Older models" group; the effort column greys out the levels the chosen model does not take, and says so under the list when it takes none. Picking a model whose effort levels leave out the current one moves the effort to the closest lower level. While the agent works, a faint "Applies once the agent finishes this turn." row sits under the columns. Values show by the names the harness gives them, never by what the harness takes. The status shows only on the session mark, with a hidden label here for screen readers. On the right one icon action: Send (primary, arrow up, disabled while the field is empty), or Stop (secondary, square) while the session works and the field is empty. Under the surface, a faint status line carries the `composer.status` slot (usage) at its right end; the session's worktree, branch and PR checks join it when the server sends them. Before the first message in the checkout, two small tonal buttons (20px, 4px corners, the accent at 14%, 22% on hover, in accent text, as most sessions should start from a fresh default branch) follow the branch: `↓ N` with an arrow-down icon and mono figures, when the branch can fast-forward from `origin`, and "Switch to <default branch>" with a two-way arrow when the checkout is on another branch that no worktree holds. Local changes before a switch open the "Uncommitted changes" dialog (Cancel, Commit & switch with a message field, Stash & switch); a refused switch or pull opens a dialog with git's output in a code block and "Stash & pull" or "Stash & switch" when local changes are the cause. Plugins can dock a sheet on its top edge through the `composer.above` slot. When the first message after a change of run options fails, a danger action sheet docks on the surface's top edge (its border and the surface's top edge red at 40%): "The agent did not start with <new values>.", a faint "Your message is back in the field." beside a ghost "Pick another" that opens the run options menu on the changed value, and a primary "Back to <previous value>" ("Go back" when several changed); the values that changed show red on the trigger, and the message returns to the empty field.

### Images
An image pasted (⌘V) or dropped into the composer takes the next number of the session and goes in the text, at the caret or where it is dropped, as its marker: an 18px pill with 4px corners, in a 9% text wash with a hairline ring, holding a 16px thumbnail with 3px corners and `#N` in 12px medium tabular figures. The marker is one character for the caret and Backspace, and it opens the full-screen view on click; its hover (accent at 18%, a 40% accent ring) also shows a 240px preview card above it, with the image and a faint "Image #N". The agent reads it as `[Image #N]`, with the image right after. Above the text, the draft's images line up as 56px thumbnails with 10px corners, each with a 20px round × badge on its top-right corner (the text at 30% over the raised ground, ringed in the raised colour) that removes the image and its marker. Hovering a thumbnail lights up its marker, and the reverse. A file that is not a PNG, JPEG, GIF or WebP, or above the agent's limit, adds nothing and shows a red message above the composer that names it. While files are dragged over it, the composer's border turns dashed accent over a 6% accent wash.

A sent message shows its images as 72px thumbnails above its text, each with its `#N` in a dark label on the bottom-left corner, and its markers in the text. Thumbnails crop to the image's top-left corner, where a screenshot starts, and load when their row scrolls into view.

A thumbnail or a marker opens the full-screen view over the whole window, on the deep ground: a 48px head that drags the window, its row lined up with the sidebar card's top row and starting after the traffic-light space, with "Image #N · i of n" and the message it came from in faint text (or "<file> · Not sent yet" for the draft's images), the image fitted in the middle with ghost ← and → buttons on its sides, and a strip of 64×44 thumbnails along the bottom, the current one ringed in accent, with a hairline between the images of different messages. ← and → move through the session's images in transcript order, or the draft's; Escape closes it and puts the focus back where it was.

### Branch Picker
The branch on the composer's status line is a ghost trigger (muted mono text, a branch icon and a chevron) that opens a composer menu. Rows are mono: local branches at full colour, then `origin/<name>` rows in muted text with a faint `origin/` prefix, an icon and no mark. A local branch held by another worktree, or by the checkout, takes a yew icon and a faint pill ("in worktree", "in checkout"); the current branch takes a yew check. While `origin` is first fetched, a faint "Fetching remote branches…" row with a spinner holds the remote rows' place; a later fetch shows a "Fetching" spinner in the search field, or in a faint row under the list when the menu has no search field. A footer says what picking the highlighted branch does ("Moves this session to the worktree .worktrees/feat-login.") beside the key hints. A checkout git refuses shows the UI's message and git's output in mono inside a danger block, and the menu stays open. The trigger is disabled while the agent runs a turn.

When the session's worktree was deleted, the composer's surface is replaced by a raised panel of the same shape with 16px padding: "Where should the agent continue?" in 16px semibold, a muted sentence saying the conversation is kept, the deleted path in faint mono, then one choice per row (Current checkout, New worktree, then the project's other worktrees under a faint "Existing worktrees" caption). A choice row is an icon, a 500-weight label (mono for a branch) and a muted description; the chosen row takes the active wash and a strong hairline. Arrow keys move the choice and Enter confirms it, as does the primary button at the bottom right ("Continue here", or "Create and continue" for a new worktree). The status line and the sidebar row show the old branch struck through, followed by "deleted", in faint text.

### Action Sheet
A raised panel docked on the composer's top edge: 10px top corners, no bottom border, and the composer's top corners go square so the two read as one surface. It slides up 8px and fades in over 180ms (`--iv-duration-base`) on `--iv-ease-out`. A head row carries an optional muted icon, a 500-weight title and a mono detail clamped to three lines; a faint caption hint sits below the content. In the attention tone the outline turns to the dashed amber outline, the composer's top edge turns dashed amber with it, and the title turns amber.

### Option List
A keyboard-first single choice inside a sheet: 36px options with 6px corners, 2px apart, body text with an optional faint caption hint on the right (a key such as "Esc"). The chosen option takes the active wash; the others take the hover wash on hover. Arrow keys move the choice, Enter submits it, Escape takes the escape action, and a click submits directly when asked. The approval sheet uses it for Allow / Deny.

### Overlays
Menus have 10px corners, 4px padding and 28px items with 4px corners; the highlighted item takes the active wash and destructive items are red. A composer menu (the working folder and branch menus, and every menu added there) is 360px wide and opens above its button, on the button's left edge, at most 360px high; with too little room above, its list shrinks and scrolls rather than open below. A list longer than ten rows (what that height holds beside a footer) gets a search field at the top, focused on open, that filters it; groups are split by a hairline and headed by a faint caption. A label too long for the row is cut with an ellipsis and shown in full on hover. A column menu is 560px wide and opens the same way: its columns sit side by side, split by hairlines, each under a sticky faint caption and scrolling on its own past 236px; a wide column takes half as much room again. Up and Down move inside a column, Left and Right to the same row in the next column, skipping greyed-out items; picking keeps it open. A footer describes the highlighted item, or says what a pick does, beside the key hints. Tooltips are 12px text with 4px corners, at most 420px wide; a mono tooltip (a command, a path) wraps its text, with a faint caption label above it. Dialogs are at most 420px wide, with 20px padding, a 16px semibold title, a muted description and right-aligned actions. All three fade and scale from 0.97 (120ms for menus and tooltips, 180ms for dialogs) on `cubic-bezier(0.22, 1, 0.36, 1)`, and reduced motion removes it.

### Disclosure and Code
Disclosures use a muted summary with a chevron that rotates 90 degrees when open.

A turn's work sits under one faint line, from the agent's first item to its last tool call. The line opens on a 14px icon at the column's edge, and the turn's text starts 22px in. While the agent works, the icon is a spinner, the line reads "Working for 12s" with a ticking clock, and "· N failed" in red once a call fails; the turn stays unfolded, so the timeline grows under it. Once the turn ends, the icon tells how (a check when it answered, a square when it was stopped, a red alert when it failed), the line reads "Worked for 1m 42s · 12 tool calls · 1 failed" and folds, so only the user's message and the answer (the agent's text after its last tool call) stay in view. A turn that ends without an answer stays unfolded and reads "Stopped after …" or "Failed after …". On hover or focus, a chevron takes the icon's place; while the turn is open it stays in place of a check, but the spinner, the square and the alert stay in view. A hairline runs to the line's right.

Unfolded, the turn is a timeline: each of the agent's sentences heads one step, marked by a 7px ring centred under the turn line's icon, on a vertical line that starts just below that icon and joins the rings; the ring turns red when one of the step's calls failed, and the ring of the step that runs is yew and pulses. Calls made before any sentence form a first step with no sentence. The sentence is in full text colour and never cut. Under it, one faint summary lists the step's calls in the past tense, joined by "·": "Ran 4 commands · read 1 file · 1 failed" (ran a command, read a file, edited a file, searched, used a skill, ran an agent, used a tool). A click or Enter folds or unfolds the step's calls; over the summary its stack icon turns into a chevron, which stays while the step is open; while one of the step's calls runs, the icon is a spinner, which stays in view until hovered. The open calls are indented under the summary, each on a branch drawn from under its icon, with 3px corners, fainter than the timeline's line. While the turn runs, only its last step is open, and a step folds to its summary when the next one starts; once it ends, its steps are open when the turn has 8 tool calls or fewer, folded above that. A folded step still shows its failed calls and its subagent calls. The turn line and each summary are buttons with the focus ring, and what is folded survives a session switch. Unfolding never moves the view.

A tool call is one row with no chevron: the icon of what it does (terminal for a command, file for a read, pencil for an edit, magnifier for a search, sparkle for a skill, robot for a subagent, a wrench otherwise), its name and its mono argument; a spinner while it runs, a red "failed" when it fails, nothing once it succeeds. Over it, or while open, its argument brightens to show it opens; its input and output open under it. Thinking is not shown, and an approval leaves a trace in the transcript only when denied: "Denied:" and the command on one muted line. Code blocks use the deep ground, mono and 6px corners, and scroll past 240px.

### Pending designs
Decided but not built, because the data they need does not exist yet. Build them this way when it arrives.
- **Letter project icons:** lettered project icons in place of the pixel creatures, chosen in a settings screen that does not exist yet.
- **Question sheet:** an action sheet for a question from the agent, its options numbered, with a "?" overlay on the session mark in place of the "!". It waits for an answer contract richer than allow or deny.
- **"Allow <rule> for this session":** a third approval option, waiting for the same contract.
- **PR icon with checks colour:** a pull-request icon on a session whose colour follows its checks.
- **Background tasks:** a dot on the session mark while a session runs a background task, the running tasks in the composer status line, and "In background" on the tool row that started one.

## Do's and Don'ts

### Do:
- **Do** take every colour, size, radius and duration from a `--iv-` token, so a theme file can override it. A harness mark's brand colour is the only literal colour.
- **Do** keep yew green for focus, selection, the primary action and "working", and use at most one primary button per surface.
- **Do** keep amber for "waiting for you" and approvals, and cursor red for errors and failures, through the `--iv-status-*` tokens.
- **Do** mark anything the user must answer with the dashed `--iv-attention-outline`, and only that.
- **Do** build plugin UI only from `@ivin/plugin-api` components, with layout through `Stack` and `Block`, and dock plugin prompts on the composer through `composer.above`.
- **Do** draw icons through `Icon` by name, in Phosphor regular weight.
- **Do** use mono for code, commands and file paths, and tabular figures for times, counts and costs.
- **Do** keep transcript rows flat and cheap: a block, text, a disclosure, a code block.

### Don't:
- **Don't** put a shadow on anything that does not float above the window, the sidebar card included.
- **Don't** put the agent's answers in a bubble: only the user's message is one.
- **Don't** use dense dashboards, IDE chrome or decoration.
- **Don't** add inline styles to screens or plugins, or import a UI library or an icon set into a plugin.
- **Don't** add a font size, weight or radius outside the scales above.
- **Don't** use red or amber for emphasis or decoration, or project hues for anything but project identity.
