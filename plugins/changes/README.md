# changes

The Changes tab of the sidebar, in the `sidebar.panel` slot (contribution `changes/panel`, titled "Changes", with the number of changes after its name through the `badge` option): the uncommitted changes of the working folder of the session on screen, against HEAD, untracked files included, through the host's `useChanges`, which lists them again after each change on disk. It follows the session on screen.

Each change is a row of the host's `ChangeList`: its status letter, its name, its folder and its added and deleted line counts (`src/rules/change-items.ts`). A click or Enter opens its diff beside the chat with `useOpenDiff`, and the row of the diff on screen (`useDiffOnScreen`) is selected. The row's Open file button opens the file itself with `useOpenFile`; a deleted file has none.

States: no session on screen, a deleted working folder, a working folder outside a git repository, no changes, and a listing git fails (the host's message, git's output under it, and Retry). The command `changes.show` (⌘3) opens the tab.
