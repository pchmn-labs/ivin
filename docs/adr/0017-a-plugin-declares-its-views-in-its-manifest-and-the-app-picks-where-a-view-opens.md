# A plugin declares its views in its manifest, and the app picks where a view opens

A **view** is something a plugin shows for a session, opened with parameters: a file, a diff, a subagent's detail, a terminal. Its **placement** is where it opens: a sub-view of the session's tab, a tab of the sheet docked on the composer, or a dialog. The plugin decides what the view shows, and the app decides where it opens, so the user can move a view (a subagent's detail from the sheet to a sub-view) without a change to the plugin.

A plugin declares each view under `views` in its manifest, with the placements it can open in and the default one, and gives its component in `activate` with `ctx.views.register`:

```json
"views": {
  "shell": {
    "title": "Terminal",
    "icon": "terminal",
    "placements": ["subView", "dialog"],
    "defaultPlacement": "subView",
    "restore": false
  }
}
```

```tsx
ctx.views.register("shell", { component, title: ({ terminalId }) => … })
ctx.views.open(sessionId, "terminal/shell", { terminalId }, { placement: "dialog" })
```

- The placement is, in this order: the user's setting `<plugin id>.<view>.placement`, which the app creates from the manifest for each view with more than one placement; the placement the caller asks for; the manifest's default. It is always one of the view's `placements`: a terminal never opens in the sheet.
- A view is identified by its name and its parameters, a JSON object: opening a view equal to an open one selects that one.
- A view opened as a sub-view is stored with the tab and opened again after a relaunch, unless the view declares `restore: false`. A view in the sheet or a dialog is never stored.
- When a session moves to another working folder, all its views close, whatever their placement.
- The app's own views are plugins' views: the file and the diff belong to the `files` and `changes` plugins, so a user plugin replaces them as it replaces any contribution ([ADR-0009](0009-the-window-frame-stays-in-the-app-and-its-features-are-plugins.md)). Opening a view that no active plugin registers shows the plugin's failure where the view would be.

## Why the manifest

All UI halves are activated when the window starts, so `register` alone would give the app the same information a moment later. The manifest keeps it available before a plugin activates, which loading UI halves on demand will need, and moving it there after the plugin API is frozen as 1.0.0 would break every plugin that has views.

## Considered options

- **The plugin picks the placement in code**: rejected, because the user could not move a view without editing the plugin.
- **One `views.placement` table in the settings**: rejected for a setting per view, which shows on its plugin's settings page and accepts only that view's placements.
- **A bottom panel placement for the terminal**: left out at first; the terminal opens as a sub-view. A placement can be added later without breaking a plugin.
- **A key given by the plugin to identify a view**: rejected, because the parameters already say which file, task or terminal the view shows.

## Consequences

- A sub-view is stored as the view's name and its parameters, no longer as a kind and a path.
- The manifest's `settings` must be read by the app, since the placement setting is one of them.
- The setting decides where a view opens; moving an open view to another placement is an act of its own, in the view's frame.
