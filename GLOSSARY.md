# ivin

A desktop app to run and supervise coding agents. These are the terms its code, docs and tickets use.

## Language

**Project**:
A folder, or a `.code-workspace` holding several folders, with its settings.

**Session**:
One agent conversation, bound to a project folder, a cwd (checkout or worktree), a branch, a harness and a model. Its status is working, waiting (on the user, such as for an approval), idle or failed.

**Harness**:
The agent CLI a session runs on (Claude Code, Codex, an ACP agent), behind one `HarnessProvider` service.

**Transcript**:
The append-only list of normalised events of a session (`user_message`, `assistant_text`, `tool_call`, `approval_request`, `status`…), each with a stable id, owned by ivin.

**Transcript items**:
The read model derived from the transcript's events: a tool call merged with its result, a subagent with its nested items, streamed text assembled. The UI and plugins render items, not events.

**Annotation**:
Typed, namespaced metadata attached to a session or a project, written by plugins, the CLI or the agent, such as `{ ns: "prs", kind: "pr", data: { url, relation: "created" } }`.

**Tab / pane layout**:
The workspace tabs, holding session, file and plugin views.
