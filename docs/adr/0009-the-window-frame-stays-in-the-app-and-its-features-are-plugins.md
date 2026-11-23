# The window's frame stays in the app, and what fills it comes from plugins

The UI package draws the window's frame: the sidebar card with its project rail and its row of tabs, the tab bar, the session view that holds the transcript list, and the places where slots render. What the user reads and works with inside that frame comes from plugin contributions, the built-in ones included: the session list is the `sessions` plugin's `sidebar.panel` contribution, the composer is the `composer` plugin's `session.composer` contribution, and transcript rows, sheets and panels were plugins already. A user plugin replaces any of them with `replaces`, as it replaces a tool call's renderer.

A built-in plugin imports only `@ivin/plugin-api` and `react`, like a user's. What it cannot build from those is added to the plugin API: a hook for each act and each piece of data (`useDraft`, `useSendMessage`, `useInterruptSession`, `useOfferedRunOptions`, `useRenameSession`…), and a host component for each part that holds the app's own machinery, such as the message field with its pasted images (`MessageField`), the run options menu, the working folder and branch pickers, and the composer's layout (`ComposerFrame`). A replacement plugin uses the same pieces or its own.

## Considered options

- **The transcript list as a plugin**: rejected because its virtualisation and scroll anchoring are what keeps a long session smooth ([ADR-0006](0006-the-transcript-stays-on-virtuoso.md)), and its rows are already contributions.
- **The tab bar as a plugin**: rejected because it is layout. It takes `tab.decoration` contributions instead.
- **The composer's parts as plugin code**: rejected for the field, the pickers and the run options menu, because they hold browser code (a contenteditable field, drag and drop, file reading) and atoms a plugin cannot reach. They are host components, so the composer plugin decides what the composer shows and does, and the host draws those parts.

## Consequences

- A plugin cannot carry CSS, so the composer's layout and the way its sheets meet the field come from `ComposerFrame`, and the sheets themselves from `ActionSheet`.
- The sidebar's first tab is the contribution `sessions/panel`, or the one that replaces it; with no `sidebar.panel` contribution the list column is empty.
- A plugin's hooks find a session among the open projects' sessions, so the session view's composer needs the session's project to be open, as it always is in the app.
