---
version: 1
slug: "src-app-app-tsx"
primary_target: "src/app/app.tsx"
related_targets: []
---

# App shell (packages/ui)

Scope: the whole desktop window: project rail, session sidebar, session view (transcript, composer, approvals), and every base component plugins get. Mode: Operate.

Audience and job: the author, all day, full-screen; sees which session works, waits or failed, opens it, answers approvals, sends the next message.

Constraints: dark and light forest themes from day one; every colour and size is a CSS custom property a theme file can override; plugins get components from the host only; transcript rows stay cheap in a virtualised list.

Reference products (craft bar, not world): Linear, Zed, Raycast, Cursor / Claude desktop. Linear for everything but density: fewer facts on screen, simple.

Open: the multi-project rail behaviour and tabs come with #32.

## Direction contract

THESIS: The layout every agent app ships (project rail, session sidebar, transcript, composer), executed at Linear/Zed/Raycast craft and kept simple: fewer facts per row, each one clear. Refuses dense dashboards, IDE chrome, chat bubbles and decoration.

OWN-WORLD: Neutrals tinted from the icon's forest greens (deep green-black ground in dark, pale green-white in light); yew green the one accent for focus, selection and the primary action; the cursor's red only for "waiting for you" and errors. System UI type, mono for code and paths, a 4px grid, 1px hairlines, 6px radii, shadows only on overlays.

STORY: The user sees at a glance which session works or waits for them, opens it, reads the transcript, answers an approval, and sends the next message without leaving the keyboard.

FIRST VIEWPORT: Left, a 52px project rail (project initials, the selected one marked, an open-folder button). Then a 260px sidebar: project name, "New session", one row per session (status mark, title, relative time). Right: a slim session header (title, model), the transcript in a centred column about 760px wide, the composer docked at the bottom with the model, Send or Interrupt, and the usage status.

FORM: the category standard, taken through the standing exit over the rolled hand (Trail Signposts); the project rail kept from that card at the user's request. seed:d9f9f00f9d7be738

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
