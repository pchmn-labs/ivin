# Tab

What the design adds to the [glossary](../../GLOSSARY.md)'s terms in the `tab` module, on the server and in the UI. The design shared by every module is in [the architecture](README.md).

- A tab stores its project and its position, so a single bar for all projects can later be a view over the same rows.
- `tab.open` takes an optional `after`, the session whose tab the new one follows; a session that already has a tab keeps its place. The UI sends it for `tab.new` when `tabs.newTabPosition` is `afterCurrent`.
- A tab stores its sub-views in SQLite, in order (a sub-view is a file, a file's uncommitted diff, or what the commits of the session's branch changed in it, `kind` and `path`), with the selected one and the working folder each was opened in (`tab.listSubViews`, `tab.openSubView`, `tab.closeSubView`). The tab's row stores whether it is in full width and whether its Session tab is selected (`tab.setFullWidth`, `tab.selectSessionTab`); opening a sub-view or going back beside the chat leaves the Session tab. Listing, opening or closing first drops those of another working folder than the session's, whatever moved the session; closing the tab or deleting the session drops them all. The UI keys them by session and working folder, so a moved session loads them again.
- Closing a tab, or the project it belongs to, ends its session's agent process when `tabs.stopAgentOnClose` is on; the next message starts a new process that resumes the conversation. The tab bar asks first when the agent is working or waiting; closing a project does not ask.
