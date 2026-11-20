# ivin

The terms ivin's code, docs and tickets use.

## Language

**Project**:
A folder, or a `.code-workspace` holding several folders, with its settings. Several projects are open at once in a window, in order; one is selected, and each has its own tab bar.
_Avoid_: workspace, repo

**Checkout**:
The project folder's own git working copy, as opposed to its worktrees.

**Worktree**:
A linked git worktree of the project's repository, on its own branch, that a session can run in so it does not share files with other sessions. ivin creates them under `<project>/.worktrees/`; a session can also start in one made outside ivin.
_Avoid_: workspace, clone

**Working folder**:
Where a session's agent runs: the checkout or one worktree. Several sessions may share one.
_Avoid_: cwd, workspace

**Session**:
One agent conversation, bound to a project folder, a working folder, a branch, a harness and its run options. Its status is preparing worktree, working, waiting (on the user, such as for an approval), idle or failed. Owns a transcript. An **archived** session is hidden from the sidebar, with no tab and no running agent, until the user restores it; deleting a session erases it with its transcript.
_Avoid_: conversation, chat, thread

**Harness**:
The agent CLI a session runs on: Claude Code, Codex or an ACP agent.

**Run options**:
The model, effort and permission mode a session's agent runs with, chosen from the values its harness offers. A change applies from the next message; a turn already running keeps the options it started with. When the first turn after a change fails, the session carries a **relaunch failure**, which offers the options that last worked.
_Avoid_: settings (the word for ivin's own settings file)

**Transcript**:
The append-only list of a session's normalised events, each with a stable id, owned by ivin.
_Avoid_: history, log, conversation

**Event**:
One normalised entry of a transcript, such as a user message, a tool call or an approval request, stored as it streams. A streamed token is not an event.
_Avoid_: message (for anything but a user or assistant message), log entry

**Transcript items**:
The read model derived from a transcript's events, and what the UI and plugin hooks expose: a tool call merged with its result and status, a subagent with its nested items, streamed text assembled.

**Approval**:
An agent's request to run a tool that the user allows or denies, together with that decision. It is open until decided, and the session waits meanwhile.
_Avoid_: permission, permission prompt

**Annotation**:
Typed, namespaced metadata attached to a session or a project, written by plugins, the CLI or the agent.

**Tab**:
Belongs to one project and shows exactly one session, with its transcript and composer. A session has at most one tab. A tab has a position in its project's tab bar, and the project remembers its selected tab. Its sub-views (files, diff, terminal) come later. A session with no tab is **inactive**, listed under "Inactive sessions" in the sidebar.

**Plugin**:
A folder with a manifest and up to two halves, a server half and a UI half, that adds a feature to ivin through the plugin API. ivin's own features are plugins too.
_Avoid_: extension, add-on

**Slot**:
A named place in the UI where plugins render their components, such as a session's badges.

**Contribution**:
One thing a plugin adds to ivin: a component in a slot, a command, a keybinding, a theme.

**Command**:
An action with an id and a title that the user, a keybinding, the CLI or a plugin can run.

**Log**:
The file `~/.ivin/logs/ivin.log`, one JSON line per raw error of the server or the UI, written for the agent debugging ivin. A plugin's errors are not in it.
_Avoid_: error log, journal

**Keybinding**:
A key mapped to a command, possibly limited to one area of the window.
_Avoid_: hotkey
