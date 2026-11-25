# ivin

The terms ivin's code, docs and tickets use.

## Language

**Project**:
A folder, or a `.code-workspace` holding several folders, with its settings. Each folder of a project is a **project folder**, and each is its own git repository. Several projects are open at once in a window, in order; one is selected, and each has its own tab bar.
_Avoid_: workspace, repo, root

**Trusted project**:
A project folder the user has said ivin may run git and sessions in, asked the first time the folder is opened. The trust covers the project's worktrees, and is never asked again for that folder.
_Avoid_: safe folder, allowed folder

**Checkout**:
The project folder's own git working copy, as opposed to its worktrees.

**Worktree**:
A linked git worktree of the project's repository, on its own branch, that a session can run in so it does not share files with other sessions. ivin creates them under `<project>/.worktrees/`; a session can also start in one made outside ivin.
_Avoid_: workspace, clone

**Working folder**:
Where a session's agent runs: the checkout, one worktree, or, for a project with several project folders, a folder ivin creates that holds one worktree per project folder. Several sessions may share a checkout or a worktree.
_Avoid_: cwd, workspace

**Session**:
One agent conversation, bound to a project folder, a working folder, a branch, a harness and its run options. Its status is preparing worktree, working, waiting (on the user, for an approval or a question, and the session says which), in background (no turn runs, but a task does), idle or failed. Owns a transcript. Its title comes from its first message, first its first line, then a short title a small model writes from it, until the agent or the user renames it; the agent never replaces the user's. An **archived** session is hidden from the sidebar, with no tab and no running agent, until the user restores it; deleting a session erases it with its transcript.
_Avoid_: conversation, chat, thread

**Harness**:
The agent CLI a session runs on: Claude Code, Codex or an ACP agent.

**Run options**:
The model, effort and permission mode a session's agent runs with, chosen from the values its harness offers. A model may take only some effort levels, or none. A change applies from the next message; a turn already running keeps the options it started with. When the first turn after a change fails, the session carries a **relaunch failure**, which offers the options that last worked.
_Avoid_: settings (the word for ivin's own settings file)

**Transcript**:
The append-only list of a session's normalised events, each with a stable id, owned by ivin.
_Avoid_: history, log, conversation

**Event**:
One normalised entry of a transcript, such as a user message, a tool call or an approval request, stored as it streams. A streamed token is not an event.
_Avoid_: message (for anything but a user or assistant message), log entry

**Image marker**:
`[Image #N]` in a user message's text: where image N of the session goes. The composer and the transcript draw it as the image's marker; the agent reads the image right after it.
_Avoid_: attachment, placeholder

**Transcript items**:
The read model derived from a transcript's events, and what the UI and plugin hooks expose: a tool call merged with its result and status, a subagent with its nested items, streamed text assembled.

**Task**:
A subagent or a command the agent starts in the background: it keeps running after the turn that started it ends, and its end makes the agent start a turn of its own to report it. It belongs to the session's agent, so stopping the agent stops it, and it is shown by the tool call that started it and by a session in the **in background** status. A subagent's steps are items under that call; a command's output is the file the agent writes it to.
_Avoid_: job, background job, process

**Turn**:
A user message that the agent reads while idle, and everything the agent does in answer to it, up to the next such message. The steers it reads on its way belong to it. Its **work** runs from its first item to its last tool call; its **answer** is the agent's text after that call, once the turn has ended. While the turn runs, that text is still part of its work.

**Step**:
One sentence the agent writes in a turn's work and the tool calls that follow it, up to its next sentence. A steer heads a step too, with the agent's next sentence under it. In a running turn, the last sentence heads a step before it has any calls.

**Steer**:
A user message the agent reads while a turn runs, when a tool call ends: it joins that turn instead of starting one. A message sent while the agent works is **pending** until the agent reads it. If the turn ends first, the message starts the next turn instead; if the user stops the turn, it goes back to the composer unread.
_Avoid_: queued message, interjection

**Approval**:
An agent's request to run a tool that the user allows or denies, together with that decision. It is open until decided, and the session waits meanwhile. When its turn or run ends first, it stays unanswered.
_Avoid_: permission, permission prompt

**Question**:
A set of questions the agent asks the user in a turn, each with options to pick (one, or several when the agent allows it) or an answer in the user's own words, together with the answers given. It is open until answered or declined, and the session waits meanwhile. When its turn or run ends first, it stays unanswered.
_Avoid_: prompt, survey

**Annotation**:
Typed, namespaced metadata attached to a session or a project, written by plugins, the CLI or the agent.

**Skill**:
A folder of instructions an agent reads when its task calls for it, in the harness's user skills folder. ivin ships its own, `ivin-customize`, and installs it there; a skill of the same name that ivin did not write is left as it is.

**Agent command**:
A skill or a command of the harness itself that the user runs by starting a message with `/name`, such as `/compact`; the harness runs it, ivin only lists them in the composer. Each says whether it is a skill and where it comes from: the project, the user, a plugin or the harness.
_Avoid_: slash command, command (which is ivin's own)

**Tab**:
Belongs to one project and shows exactly one session, with its transcript and composer. A session has at most one tab. A tab has a position in its project's tab bar, and the project remembers its selected tab. Beside its session, a tab shows its sub-views; in **full width** they cover the main area, and a Session tab in their row shows the session's chat. A session with no tab is **inactive**, listed under "Inactive sessions" in the sidebar.

**View**:
Something a plugin shows for a session, opened with parameters: a file, a diff of a file. A view is identified by its plugin, its name and its parameters; opening an equal view selects the one that is open. The app's own views belong to the `files` and `changes` plugins. A session's views close when it moves to another working folder.
_Avoid_: panel, widget

**Placement**:
Where a view opens: as a sub-view of the session's tab, as a tab of the sheet docked on the composer, or in a dialog. The plugin declares the placements a view can open in and its default; the user's setting for the view, then the caller, then the default pick one of them.

**Sub-view**:
A view opened in a tab's own row, beside its chat or across the main area in full width. A tab keeps its sub-views in the order they were opened, with one selected, and shows them again after a relaunch unless the view declares it does not restore.
_Avoid_: editor, pane

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

**CLI**:
The `ivin` command, which reaches the running app over its socket. ivin puts it on its agents' `PATH`; a link in `/usr/local/bin` or `~/.local/bin` puts it in the user's shell too.
_Avoid_: ivin binary

**Keybinding**:
A key mapped to a command, possibly limited to one area of the window.
_Avoid_: hotkey
