---
name: ivin
description: A desktop app to run and supervise coding agents, in the forest theme.
colors:
  ground: "#0f1613"
  ground-subtle: "#0b110e"
  ground-raised: "#18211c"
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
  cursor-red: "#f0644a"
  cursor-red-subtle: "rgba(229, 83, 59, 0.14)"
  ground-light: "#f8faf7"
  ground-subtle-light: "#f2f5f1"
  ground-raised-light: "#ffffff"
  hover-wash-light: "rgba(23, 62, 43, 0.05)"
  active-wash-light: "rgba(23, 62, 43, 0.09)"
  hairline-light: "rgba(11, 35, 24, 0.1)"
  hairline-strong-light: "rgba(11, 35, 24, 0.18)"
  text-light: "#10201a"
  text-muted-light: "#4f6157"
  text-faint-light: "#5d6f63"
  yew-light: "#2e6b3e"
  yew-hover-light: "#255a33"
  yew-contrast-light: "#ffffff"
  cursor-red-light: "#c8402a"
  cursor-red-subtle-light: "rgba(200, 64, 42, 0.1)"
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
  block-subtle:
    backgroundColor: "{colors.ground-subtle}"
    rounded: "{rounded.md}"
  block-attention:
    backgroundColor: "{colors.ground-raised}"
    rounded: "{rounded.md}"
  block-danger:
    backgroundColor: "{colors.cursor-red-subtle}"
    textColor: "{colors.cursor-red}"
    rounded: "{rounded.md}"
  code-block:
    backgroundColor: "{colors.ground-subtle}"
    typography: "{typography.mono}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
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

ivin uses the layout every agent app ships: a project rail, a session sidebar, a transcript, a composer. It is finished to the level of Linear, Zed and Raycast, with fewer facts per row than Linear. The look is calm and flat, built for a window that stays open all day. Neutrals are tinted from the app icon's forest greens. Yew green is the one accent. The icon's red cursor appears only when the user is needed or something failed.

All colours, sizes, radii and durations are `--iv-` CSS custom properties in `packages/ui/src/core/theme/tokens.css`. A theme changes the app by overriding those variables. The built-in theme is "forest", in a dark and a light variant, and follows the system appearance unless `data-theme` forces one. Plugins get the same components as the built-in screens, only through `@ivin/plugin-api`. The reasons are in `docs/adr/0002-design-system-on-base-ui-and-css-custom-properties.md`.

The design does without dense dashboards, IDE chrome, chat bubbles and decoration.

**Key Characteristics:**
- Flat, tinted neutrals. Depth comes from three ground tones and 1px hairlines.
- One green accent and one red signal, each with a single job.
- System UI type at 13px body, with mono for code, commands and paths.
- A 4px grid, 28px controls (`--iv-control-md`; 24px small, `--iv-control-sm`), 30px list rows (`--iv-row-height`), 6px corners.
- Shadows only on overlays: menus, tooltips and dialogs.
- Every value is a `--iv-` token a theme file can override.

## Colors

The palette is green-tinted neutrals, one yew-green accent and one cursor red. Each has a light-theme counterpart (the `-light` keys).

### Primary
- **Yew Green** (`--iv-accent`): the primary button, the selected tab underline, the focus ring, the caret, links, text selection (32% mix), the connected dot and the "working" status mark. In light it darkens to a deep forest green so white text on it stays legible.
- **Yew Hover** (`--iv-accent-hover`): hover and press on the primary button.
- **Yew Contrast** (`--iv-accent-contrast`): text on a yew fill.

### Secondary
- **Cursor Red** (`--iv-danger`): the "waiting for you" status, approvals awaiting an answer, errors, failed tool calls and destructive menu items. Taken from the red terminal cursor in the app icon.
- **Cursor Red Wash** (`--iv-danger-subtle`): the fill of error blocks and danger buttons.

### Neutral
- **Forest Ground** (`--iv-bg`): the main pane and transcript.
- **Deep Ground** (`--iv-bg-subtle`): the project rail, the sidebar, code blocks, user messages and table headers. In dark it sits below the main pane; in light it is a step greyer.
- **Raised Ground** (`--iv-bg-raised`): controls, the composer, approval blocks, menus, tooltips and dialogs.
- **Hover Wash / Active Wash** (`--iv-bg-hover`, `--iv-bg-active`): translucent green washes for hover, press, the selected row, the highlighted menu item and inline code.
- **Hairline / Strong Hairline** (`--iv-border`, `--iv-border-strong`): dividers and block borders (hairline); control, overlay and composer borders, and scrollbar thumbs (strong).
- **Text / Muted / Faint** (`--iv-text`, `--iv-text-muted`, `--iv-text-faint`): primary copy; secondary copy and ghost buttons; metadata, placeholders, timestamps and the idle status.

### Named Rules
**The One Accent Rule.** Yew green marks focus, selection, the primary action and "working". It never decorates.

**The Red Means You Rule.** Cursor red marks only what needs the user (waiting, an approval) or what went wrong (error, failure). A status colour goes through `--iv-status-working`, `--iv-status-waiting`, `--iv-status-idle` or `--iv-status-failed`, never a raw colour.

**The Token-Only Rule.** No colour, font or size outside the `--iv-` tokens. Derived tints use `color-mix()` on a token (accent blocks at 8% fill and 40% border, the project mark at 14% fill and 45% border).

## Typography

**Body Font:** the system UI font (`-apple-system`, SF Pro Text, `system-ui`, Segoe UI)
**Mono Font:** `ui-monospace` (SF Mono, Menlo)

**Character:** the platform's own UI type, so ivin reads like a native desktop tool. Mono marks anything the user could type or paste: code, commands, file paths.

### Hierarchy
- **Headline** (600, 20px/28px): level-1 headings inside Markdown answers.
- **Title Large** (600, 16px/24px): dialog titles and level-2 Markdown headings.
- **Title** (600, 14px/20px): the project name in the sidebar and level-3/4 Markdown headings.
- **Body** (400, 13px/20px): the default for the whole app: transcript text, row titles, controls.
- **Label** (500, 12px/16px): small buttons, field labels, tooltips, status labels, tool arguments and tool status.
- **Caption** (500, 11px/16px): the "You" and "Claude" speaker labels above messages, in muted text.
- **Mono** (400, 12px/20px): code blocks, tool arguments and file paths. Inline code is 0.92em.

Weights are 400, 500 and 600 only. Times, counts and costs use tabular figures.

### Named Rules
**The Native Type Rule.** Body copy is 13px system UI. Hierarchy comes from weight and muted tones, not size jumps. 20px is the largest size and appears only inside Markdown.

## Layout

The window is a three-column grid: a 52px project rail, a 260px session sidebar, and the main pane. With no project open the sidebar column drops out. The rail and sidebar sit on the deep ground, each closed by a hairline on its right.

The main pane stacks a slim session header (the title, then the model as faint text, 12px by 24px padding, closed by a hairline), the transcript, and the composer. The transcript and composer share a centred column at most 760px wide (`--iv-content-width`), with 24px side padding. Transcript items are separated by 8px of vertical padding. The list is virtualised, so a row's look must stay cheap.

Spacing is a 4px grid (`--iv-space-1` to `--iv-space-10`). The sidebar uses 12px padding and gaps, session rows are 2px apart, and layout gaps go through `Stack` at 0, 4, 8, 12, 16, 24 or 32px. Screens and plugins carry no inline styles: layout goes through `Stack`, `Block`, or a CSS file beside the screen.

## Elevation & Depth

The app is flat at rest. Depth comes from the three ground tones (deep, ground, raised) and 1px hairlines. Only things that float above the window cast a shadow: menus, tooltips and dialogs. A dialog adds a dim backdrop (`--iv-backdrop`, set per theme) and a strong hairline.

### Shadow Vocabulary
- **Overlay** (`--iv-shadow-overlay`): menus, tooltips and dialogs. In dark, `0 8px 24px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3)`; in light, the same shape in a soft green-black.

### Named Rules
**The Overlays-Only Rule.** A shadow means "this floats above the window". Blocks, the composer, rows and buttons never cast one.

## Shapes

Corners are gently rounded and come in three sizes: 4px (`sm`) for menu items, tooltips and inline code; 6px (`md`) for buttons, fields, rows, blocks, code blocks and the project mark; 10px (`lg`) for the composer, menus, dialogs and scrollbar thumbs. Borders are always 1px. The one 2px line is the selected tab underline. Status marks are circles.

## Components

Components live in `packages/ui/src/core/components/<component>/`, one folder each, built on Base UI where behaviour matters (menu, dialog, tooltip, tabs). Plugins get them through the `HostComponents` in `packages/plugin-api/src/components.ts`, which take data rather than compound children.

### Buttons
- **Shape:** 6px corners, a 1px border slot, 500 weight. Medium is 28px tall with 12px side padding; small is 24px tall with 8px padding and 12px text. Icon buttons are square.
- **Primary:** yew fill with yew-contrast text. One per surface: Send, Allow.
- **Secondary:** raised ground, strong hairline, default text. The paired alternative: Deny, Interrupt, New session.
- **Ghost:** transparent and muted, for toolbar and row actions.
- **Danger:** red wash and red text.
- **States:** hover changes fill only (yew hover on primary, hover wash elsewhere) over 120ms; press uses the active wash; disabled drops to 45% opacity. Focus is the global 2px yew outline, 2px offset.

### Blocks
- **Use:** the bordered box for a transcript item. 1px hairline, 6px corners, padding 8, 12 or 16px.
- **Tones:** plain (transparent); subtle (deep ground, for user messages); accent (yew at 8% fill and 40% border); attention (raised ground with a full cursor-red border, for an approval awaiting an answer); danger (red wash and a 40% red border, for errors).

### Inputs / Fields
- **Style:** raised ground, strong hairline, 6px corners, 28px tall. The text area grows with its content up to 240px. Placeholders are faint.
- **Focus:** the border turns to the focus ring colour.
- **Disabled:** 45% opacity. A select matches a field with a muted chevron.

### List Rows
- **Style:** 30px tall, 6px corners, 8px padding: a leading status mark, a truncated title, then faint tabular metadata (relative time).
- **States:** hover wash; selected rows take the active wash and 500 weight. Row actions appear only on hover, focus or selection.

### Navigation
- **Project rail:** 32px square project marks in yew (14% fill, 45% border, 600-weight initials), an open-folder ghost button, and the connection dot (faint, yew when connected, red when failed) pinned to the bottom.
- **Tabs:** 32px tall, muted 500-weight labels, a 2px yew underline on the active tab, over a hairline.

### Status Mark
The signature component: it says whether an agent works, waits or failed, at a glance. Working is a 6px yew dot pulsing over 1.6s (`--iv-duration-pulse`; the loader icon spins on `--iv-duration-spin`). Waiting is a larger 8px red dot. Idle is a faint 1.5px ring. Failed is red. It always carries a label, visible or hidden for screen readers.

### Composer
A raised 10px-corner surface with a strong hairline, docked at the bottom of the centred column. The text field sits flat inside it, and the whole surface takes the focus ring colour when focused. Below the field: the session status and usage on the left, Interrupt (secondary) and Send (primary) on the right.

### Overlays
Menus have 10px corners, 4px padding and 28px items with 4px corners; the highlighted item takes the active wash and destructive items are red. Tooltips are 12px text with 4px corners. Dialogs are at most 420px wide, with 20px padding, a 16px semibold title, a muted description and right-aligned actions. All three fade and scale from 0.97 (120ms for menus and tooltips, 180ms for dialogs) on `cubic-bezier(0.22, 1, 0.36, 1)`, and reduced motion removes it.

### Disclosure and Code
Disclosures (thinking, tool output) use a muted summary with a chevron that rotates 90 degrees when open. Code blocks use the deep ground, 12px mono and 6px corners, and scroll past 240px.

## Do's and Don'ts

### Do:
- **Do** take every colour, size, radius and duration from a `--iv-` token, so a theme file can override it.
- **Do** keep yew green for focus, selection, the primary action and "working", and use at most one primary button per surface.
- **Do** keep cursor red for "waiting for you", approvals, errors and failures, through the `--iv-status-*` tokens.
- **Do** build plugin UI only from `@ivin/plugin-api` components, with layout through `Stack` and `Block`.
- **Do** use mono for code, commands and file paths, and tabular figures for times, counts and costs.
- **Do** keep transcript rows flat and cheap: a block, text, a disclosure, a code block.

### Don't:
- **Don't** put a shadow on anything that does not float above the window.
- **Don't** use chat bubbles, dense dashboards, IDE chrome or decoration.
- **Don't** add inline styles to screens or plugins, or import a UI library into a plugin.
- **Don't** add a font size, weight or radius outside the scales above.
- **Don't** use red for emphasis or decoration.
