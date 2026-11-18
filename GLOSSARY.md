# ivin

The terms ivin's code, docs and tickets use.

## Language

**Project**:
A folder, or a `.code-workspace` holding several folders, with its settings.

**Session**:
One agent conversation, bound to a project folder, a cwd (checkout or worktree), a branch, a harness and a model. Its status is working, waiting (on the user, such as for an approval), idle or failed. Owns a transcript.

**Harness**:
The agent CLI a session runs on: Claude Code, Codex or an ACP agent.

**Transcript**:
The append-only list of a session's normalised events, each with a stable id, owned by ivin.

**Transcript items**:
The read model derived from a transcript's events, and what the UI and plugin hooks expose: a tool call merged with its result and status, a subagent with its nested items, streamed text assembled.

**Annotation**:
Typed, namespaced metadata attached to a session or a project, written by plugins, the CLI or the agent.

**Tab / pane layout**:
The workspace tabs, holding session, file and plugin views.

**Command**:
An action with an id and a title that the user, a keybinding, the CLI or a plugin can run.

**Keybinding**:
A key mapped to a command, possibly limited to one area of the window.
_Avoid_: hotkey
