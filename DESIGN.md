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
  cursor-red-outline: "color-mix(in srgb, #f0644a 60%, transparent)"
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
    backgroundColor: "{colors.cursor-red}"
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
  group-label:
    textColor: "{colors.text-faint}"
    typography: "{typography.caption}"
  group-label-needs-you:
    textColor: "{colors.cursor-red}"
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

ivin uses the layout every agent app ships: a project and session column, a tab bar, a transcript, a composer. It is finished to the level of Linear, Zed and Raycast, with fewer facts per row than Linear. The look is calm and flat, built for a window that stays open all day. Neutrals are tinted from the app icon's forest greens. Yew green is the one accent. The icon's red cursor appears only when the user is needed or something failed.

All colours, sizes, radii and durations are `--iv-` CSS custom properties in `packages/ui/src/core/theme/tokens.css`. A theme changes the app by overriding those variables. The built-in theme is "forest", in a dark and a light variant, and follows the system appearance unless `data-theme` forces one. The dark variant is deep forest green; the light variant ("Mousse") is a warm moss-paper, with borders and washes in a warm olive ink. Plugins get the same components as the built-in screens, only through `@ivin/plugin-api`. The reasons are in `docs/adr/0002-design-system-on-base-ui-and-css-custom-properties.md`.

The design does without dense dashboards, IDE chrome and decoration.

**Key Characteristics:**
- Flat, tinted neutrals. Depth comes from four ground tones (deep, ground, card, raised) and 1px hairlines.
- One green accent and one red signal, each with a single job. Dashed red means "the user must answer".
- System UI type at 13px body, with mono for code, commands and paths.
- A 4px grid, 28px controls (`--iv-control-md`; 24px small, `--iv-control-sm`), 30px list rows (`--iv-row-height`), 6px corners on controls and 10px on surfaces.
- Shadows only on overlays: menus, tooltips and dialogs. The sidebar card floats by inset and border, not shadow.
- Every value is a `--iv-` token a theme file can override; the Claude mark is the one exception.

## Colors

The palette is green-tinted neutrals, one yew-green accent, one cursor red, six project hues and the Claude brand orange. Each theme colour has a light-theme counterpart (the `-light` keys).

### Primary
- **Yew Green** (`--iv-accent`): the primary button, the selected tab underline, the focus ring, the caret, links, text selection (32% mix), the connected dot, the "working" status mark and the working ring on the session mark. In light it darkens to a deep forest green so white text on it stays legible.
- **Yew Hover** (`--iv-accent-hover`): hover and press on the primary button.
- **Yew Contrast** (`--iv-accent-contrast`): text on a yew fill.
- **Bubble** (`--iv-bubble`): the user's message. Yew mixed into the raised ground (14% in dark, 16% in light), so the user's own words read as theirs without a second accent.

### Secondary
- **Cursor Red** (`--iv-danger`): "waiting for you" and "failed" status, the "Needs you" group label, the project row badge, the approval sheet title, errors, failed tool calls and destructive menu items. Taken from the red terminal cursor in the app icon.
- **Cursor Red Wash** (`--iv-danger-subtle`): the fill of error blocks and danger buttons.
- **Cursor Red Outline** (`--iv-danger-outline`): cursor red at 60%, used only as a dashed 1px line around something the user must answer.

### Tertiary
- **Project Hues** (`--iv-project-hue-0` to `-5`): sage, slate blue, ochre, lilac, clay and teal, muted in dark and deepened in light. A project's pixel creature takes one hue, chosen from its name. They identify projects and nothing else.
- **Claude Orange** (`claude-mark`, set in `harness-mark.css`): the Claude mark on session rows and beside the model in the composer. It is the harness's brand colour, so it stays fixed across themes.

### Neutral
- **Forest Ground** (`--iv-bg`): the window, the main area and the transcript.
- **Card Ground** (`--iv-bg-card`): the floating sidebar card. In both themes it is a step darker than the ground; in dark it shares the deep ground's tone.
- **Deep Ground** (`--iv-bg-subtle`): code blocks, subtle blocks and table headers.
- **Raised Ground** (`--iv-bg-raised`): controls, the composer, the action sheet, menus, tooltips and dialogs.
- **Hover Wash / Active Wash** (`--iv-bg-hover`, `--iv-bg-active`): translucent washes (green in dark, olive in light) for hover, press, the selected row, the selected option, the current project, the highlighted menu item and inline code.
- **Hairline / Strong Hairline** (`--iv-border`, `--iv-border-strong`): dividers, the sidebar card and block borders (hairline); controls, overlays, the composer and the action sheet, and scrollbar thumbs (strong).
- **Text / Muted / Faint** (`--iv-text`, `--iv-text-muted`, `--iv-text-faint`): primary copy; secondary copy, ghost buttons and the composer's model; metadata, group labels, key hints, placeholders, timestamps and the idle status.

### Named Rules
**The One Accent Rule.** Yew green marks focus, selection, the primary action and "working". It never decorates.

**The Red Means You Rule.** Cursor red marks only what needs the user (waiting, an approval) or what went wrong (error, failure). A status colour goes through `--iv-status-working`, `--iv-status-waiting`, `--iv-status-idle` or `--iv-status-failed`, never a raw colour.

**The Token-Only Rule.** No colour, font or size outside the `--iv-` tokens. Derived tints use `color-mix()` on a token (accent blocks at 8% fill and 40% border, the bubble at 14% or 16%, the danger outline at 60%). The one exception is the Claude mark's brand orange, which belongs to the harness, not the theme.

## Typography

**Body Font:** the system UI font (`-apple-system`, SF Pro Text, `system-ui`, Segoe UI)
**Mono Font:** `ui-monospace` (SF Mono, Menlo)

**Character:** the platform's own UI type, so ivin reads like a native desktop tool. Mono marks anything the user could type or paste: code, commands, file paths, the command an approval asks about.

### Hierarchy
- **Headline** (600, 20px/28px): level-1 headings inside Markdown answers.
- **Title Large** (600, 16px/24px): dialog titles and level-2 Markdown headings.
- **Title** (600, 14px/20px): the project name at the head of the session list and level-3/4 Markdown headings.
- **Body** (400, 13px/20px): the default for the whole app: transcript text, row titles, options, controls.
- **Label** (500, 12px/16px): small buttons, field labels, tooltips, status labels, the session title in the main title bar, the composer's model, tool arguments and a failed tool's status.
- **Caption** (500, 11px/16px): the session group labels with their counts, the project badge (600), and key hints in the action sheet and option list.
- **Mono** (400, 12px/20px): code blocks, tool arguments, file paths and the approval detail (clamped to three lines). Inline code is 0.92em.

Weights are 400, 500 and 600 only. Times, counts and costs use tabular figures.

### Named Rules
**The Native Type Rule.** Body copy is 13px system UI. Hierarchy comes from weight and muted tones, not size jumps. 20px is the largest size and appears only inside Markdown.

## Layout

The window is a two-column grid. On the left, a floating sidebar card 300px wide, inset 8px from the top, bottom and left window edges. On the right, the main area on the forest ground. The sidebar toggle removes the card, and the main area then takes the full width. With no project open the window is a single centred column, with the connection dot in the bottom-left corner.

The card stacks a 40px draggable top row, and a body. The macOS traffic lights sit inset 15pt from the card's top-left corner, centred on the top row; the row holds 78px of space for them (`--iv-traffic-lights-width`), then the sidebar toggle, with back and forward 2px apart at the row's right end, all three ghost icon buttons. The body splits into a 44px project rail (`--iv-rail-width`, a hairline on its right) and the list column.

The rail holds one 32px button per open project, in order, 8px corners, with the project's 20px pixel creature; a red count badge sits on its top-right corner for the sessions waiting on the user. Below, a spacer pushes the open-folder ghost icon button and the connection dot (faint, yew when connected, red when failed) to the bottom. The list column opens with a 36px head: the selected project's 16px creature, its name in 14px semibold, New session, the small chevron beside it that opens the model menu for the next session, and an ellipsis menu with Close project. Under it, the project's sessions that have an open tab fall into two groups, "Needs you" first (red label) and "Sessions" after, each with a caption label and its count, in tab order inside each; an empty group is not shown, and a project with no tab says "No sessions in <name> yet. Start one with New session." Rows are 2px apart inside 8px side padding.

The main area opens with a slim 40px draggable title bar (8px from the top) holding the selected project's tab bar (see Navigation); when the sidebar is closed the traffic-light space and the shell controls move into it. Below it come the transcript and the composer, which share a centred column at most 760px wide (`--iv-content-width`), with 24px side padding. Transcript items are separated by 8px of vertical padding. The list is virtualised, so a row's look must stay cheap.

Spacing is a 4px grid (`--iv-space-1` to `--iv-space-10`). Layout gaps go through `Stack` at 0, 4, 8, 12, 16, 24 or 32px. Screens and plugins carry no inline styles: layout goes through `Stack`, `Block`, or a CSS file beside the screen.

## Elevation & Depth

The app is flat at rest. Depth comes from four ground tones and 1px hairlines. The sidebar card reads as floating because it is inset from the window edges, sits on its own card ground and carries a hairline; it casts no shadow. The action sheet docks onto the composer and shares its edge rather than rising above it. Only things that float above the window cast a shadow: menus, tooltips and dialogs. A dialog adds a dim backdrop (`--iv-backdrop`, set per theme) and a strong hairline.

### Shadow Vocabulary
- **Overlay** (`--iv-shadow-overlay`): menus, tooltips and dialogs. In dark, `0 8px 24px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3)`; in light, the same shape in a soft green-black.

A zero-blur `box-shadow` ring that stands in for a border (the current project's 1px hairline ring, the badge's 2px card-coloured ring, the idle status ring) is a line, not elevation.

### Named Rules
**The Overlays-Only Rule.** A shadow means "this floats above the window". Blocks, the sidebar card, the composer, the action sheet, rows and buttons never cast one.

## Shapes

Corners are gently rounded in three sizes: 4px (`sm`) for menu items, tooltips, inline code and the bubble's tail corner; 6px (`md`) for buttons, fields, rows, options, blocks and code blocks; 10px (`lg`) for the composer, the action sheet, menus, dialogs, and scrollbar thumbs. Large surfaces that frame the app take `--iv-radius-card` (10px): the sidebar card and the bubble. The user's bubble is rounded on three corners and keeps a 4px corner at the bottom right, toward the user's side.

Borders are 1px. The one 2px line is the selected tab underline. Status marks and overlays on the session mark are circles; the project badge is a pill. Project creatures are 8 by 8 pixel grids drawn with crisp edges, at 16px in the project column.

### Named Rules
**The Dashed Red Rule.** A dashed 1px line in `--iv-danger-outline` means "the user must answer". It goes around a waiting session row and the approval sheet, and nowhere else. A solid red line means an error, not a question.

## Components

Components live in `packages/ui/src/core/components/<component>/`, one folder each, built on Base UI where behaviour matters (menu, dialog, tooltip, tabs). Plugins get them through the `HostComponents` in `packages/plugin-api/src/components.ts`, which take data rather than compound children.

### Buttons
- **Shape:** 6px corners, a 1px border slot, 500 weight. Medium is 28px tall with 12px side padding; small is 24px tall with 8px padding and 12px text. Icon buttons are square.
- **Primary:** yew fill with yew-contrast text. One per surface: Send, Open folder.
- **Secondary (default):** raised ground, strong hairline, default text: the composer's Stop.
- **Ghost:** transparent and muted, for toolbar, shell and row actions, New session and the model chevron.
- **Danger:** red wash and red text.
- **States:** hover changes fill only (yew hover on primary, hover wash elsewhere) over 120ms; press uses the active wash; disabled drops to 45% opacity (`--iv-opacity-disabled`, shared by fields, selects, menu items and options). Focus is the global 2px yew outline, 2px offset.

### Icons
Phosphor icons at regular weight, 16px by default and 14px inline with small text, drawn through `Icon` from a fixed list of names (plus, folder-open, send, square, check, x, chevrons, ellipsis, terminal, file, pencil, circle-alert, loader, copy, git-branch, brain, wrench, user, sparkles, arrows, panel-left, new-session). A screen or plugin asks for a name, never imports an icon. The loader spins on `--iv-duration-spin` (900ms).

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
- **States:** hover wash; selected rows take the active wash and 500 weight; a row whose session waits on the user takes the dashed red outline, inset by 1px. Row actions appear only on hover, focus or selection.

### Session Mark
The signature of the session list: the 16px Claude mark with a small circular overlay at its bottom-right, cut out from the card ground by a ring of the card colour. Working is a 10px yew ring with one open quarter, spinning on `--iv-duration-spin`. Waiting (approval needed) is an 11px red disc with a "!". Failed is a 10px hollow red ring. Idle shows no overlay. The status always has a hidden label for screen readers.

### Status Mark
A labelled status for plugins. Working is a 6px yew dot pulsing over 1.6s (`--iv-duration-pulse`). Waiting is a larger 8px red dot. Idle is a faint 1.5px ring. Failed is red. It always carries a label, visible or hidden.

### Navigation
- **Project rail:** a 44px column of 32px project buttons with 8px corners (`--iv-rail-button-size`), each showing the 20px creature. The selected button takes the raised background, a 1px hairline ring and a faint shadow (`--iv-shadow-raised`); an unselected one takes the hover wash on hover. The label and tooltip are the project's name, with " · N waiting for you" when sessions wait. The red pill badge (`--iv-badge-size` tall, 11px semibold tabular count) sits on the button's top-right corner, ringed in the card colour. The open-folder ghost icon button and the connection dot close the rail.
- **List head:** 36px (`--iv-list-head-height`): creature, project name, New session with the model chevron, and a ghost ellipsis menu holding Close project.
- **Session groups:** caption labels in faint text with a tabular count; "Needs you" is in cursor red.
- **Model menu:** a small ghost chevron beside New session opens a menu of models; the current choice carries a check, and picking one starts a session with it. The composer then shows that session's model, fixed at creation, as muted 12px text beside a 14px Claude mark.
- **Tab bar:** in the 40px main title bar, the selected project's tabs followed by a ghost New session icon button (plus; it starts a session with the model chosen in the model menu). A tab is `--iv-tab-height` (30px) tall with `--iv-radius-tab` (8px) corners, `--iv-tab-width` (240px) wide whatever its title, shrinking equally with the room left down to `--iv-tab-min-width` (180px) before the bar scrolls, 4px apart, its title cut with an ellipsis. It shows the session mark, then the title in muted 500-weight small text. The selected tab takes the raised background with a 1px hairline ring and a main-colour title; an unselected tab takes the hover wash on hover. A 20px close button (x) appears only on hover or keyboard focus; the title gives it room, the tab keeps its width. The bar scrolls sideways with no visible scrollbar. Tabs reorder by drag, with a 2px yew drop line; Left and Right arrows move between tabs. The prototype's separators between unselected tabs are left out.
- **Tabs (component):** the underlined tabs for inside a panel: 32px tall, muted 500-weight labels, a 2px yew underline on the active tab, over a hairline. The tab bar above does not use it.

### Composer
A raised 10px-corner surface with a strong hairline, docked at the bottom of the centred column. The text field sits flat inside it, and the whole surface takes the focus ring colour when focused. Below the field: the session's model on the left (the status shows only on the session mark, with a hidden label here for screen readers) and one icon action on the right: Send (primary, arrow up, disabled while the field is empty), or Stop (secondary, square) while the session works and the field is empty. Under the surface, a faint status line carries the `composer.status` slot (usage) at its right end; the prototype's worktree, branch and PR checks join it when the server sends them. Plugins can dock a sheet on its top edge through the `composer.above` slot.

### Action Sheet
A raised panel docked on the composer's top edge: 10px top corners, no bottom border, and the composer's top corners go square so the two read as one surface. It slides up 8px and fades in over 180ms (`--iv-duration-base`) on `--iv-ease-out`. A head row carries an optional muted icon, a 500-weight title and a mono detail clamped to three lines; a faint caption hint sits below the content. In the danger tone the outline turns to the dashed red outline, the composer's top edge turns dashed red with it, and the title turns red.

### Option List
A keyboard-first single choice inside a sheet: 36px options with 6px corners, 2px apart, body text with an optional faint caption hint on the right (a key such as "Esc"). The chosen option takes the active wash; the others take the hover wash on hover. Arrow keys move the choice, Enter submits it, Escape takes the escape action, and a click submits directly when asked. The approval sheet uses it for Allow / Deny.

### Overlays
Menus have 10px corners, 4px padding and 28px items with 4px corners; the highlighted item takes the active wash and destructive items are red. Tooltips are 12px text with 4px corners. Dialogs are at most 420px wide, with 20px padding, a 16px semibold title, a muted description and right-aligned actions. All three fade and scale from 0.97 (120ms for menus and tooltips, 180ms for dialogs) on `cubic-bezier(0.22, 1, 0.36, 1)`, and reduced motion removes it.

### Disclosure and Code
Disclosures (tool output) use a muted summary with a chevron that rotates 90 degrees when open. A tool call is one row: chevron, the tool's icon (terminal for Bash, file for Read, pencil for edits, a wrench otherwise), its name and its mono argument; a spinner while it runs, a red "failed" when it fails, nothing once it succeeds. Its input and output open under the chevron. Thinking is not shown, and an approval leaves a trace in the transcript only when denied: "Denied:" and the command on one muted line. Code blocks use the deep ground, 12px mono and 6px corners, and scroll past 240px.

### Pending designs
Decided but not built, because the data they need does not exist yet. Build them this way when it arrives.
- **Letter project icons:** lettered project icons in place of the pixel creatures, chosen in a settings screen that does not exist yet.
- **Question sheet:** an action sheet for a question from the agent, with a "?" overlay on the session mark in place of the "!". It waits for an answer contract richer than allow or deny.
- **"Allow <rule> for this session":** a third approval option, waiting for the same contract.
- **PR icon with checks colour:** a pull-request icon on a session whose colour follows its checks.
- **Background-task dot:** a dot showing that a session runs a background task.

## Do's and Don'ts

### Do:
- **Do** take every colour, size, radius and duration from a `--iv-` token, so a theme file can override it. The Claude mark's orange is the only literal colour.
- **Do** keep yew green for focus, selection, the primary action and "working", and use at most one primary button per surface.
- **Do** keep cursor red for "waiting for you", approvals, errors and failures, through the `--iv-status-*` tokens.
- **Do** mark anything the user must answer with the dashed `--iv-danger-outline`, and only that.
- **Do** build plugin UI only from `@ivin/plugin-api` components, with layout through `Stack` and `Block`, and dock plugin prompts on the composer through `composer.above`.
- **Do** draw icons through `Icon` by name, in Phosphor regular weight.
- **Do** use mono for code, commands and file paths, and tabular figures for times, counts and costs.
- **Do** keep transcript rows flat and cheap: a block, text, a disclosure, a code block.

### Don't:
- **Don't** put a shadow on anything that does not float above the window, the sidebar card included.
- **Don't** put Claude's answers in a bubble: only the user's message is one.
- **Don't** use dense dashboards, IDE chrome or decoration.
- **Don't** add inline styles to screens or plugins, or import a UI library or an icon set into a plugin.
- **Don't** add a font size, weight or radius outside the scales above.
- **Don't** use red for emphasis or decoration, or project hues for anything but project identity.
