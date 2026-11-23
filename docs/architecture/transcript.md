# Transcript

What the design adds to the [glossary](../../GLOSSARY.md)'s terms in the `transcript` module, on the server and in the UI. The design shared by every module is in [the architecture](README.md).

- Plugins render transcript items; they don't re-derive them from events.

## Stored items

- Each transcript item is stored in `transcript_items`, written in the same transaction as the event that creates or changes it. `transcript.getItems` and `transcript.watchItems` read only the items of the page asked for, never the events; `transcript.listImages` reads only the user messages.
- `transcript_item_states` holds, per session, the version of the derivation rules its items were derived with and the assistant message still open, so a writer started after a restart carries on from the stored items: a tool result or a decision still updates its item, and assistant text still joins the open message.
- A session whose items are absent or derived with older rules (`ITEMS_VERSION`) gets them derived from all its events on its next read or write, once. A change to the rules that alters stored items bumps that version. A tool call's `kind` is computed again on each read, so a change to the harness's tool table needs no new version.
- When a turn or a run ends with approvals or questions still open, a `request_unanswered` event closes each one: an approval's decision, or a question's status, becomes `unanswered`. At startup, a session left working or waiting gets the same events, and a new run gives them to any request its session still holds open, such as one left by a run from before this event existed.

## Owning the transcript

- Codex and ACP have no equivalent of Claude's JSONL, and annotations and plugins need event ids that don't depend on a provider's file.
- Plugins, search and the UI read one store with one shape, whatever the harness, and ivin keeps events providers drop or rewrite (approvals, steering, interruptions, timings).
- Providers keep their own files for resuming: ivin stores the provider's session id (Claude `--resume`, Codex thread id, ACP session id) and resumes through it. ivin's copy is for display and plugins, never fed back to the agent.
- When the two diverge (a session resumed in a terminal, a Claude `/compact`), the provider's files win for the agent and ivin appends what it sees on the next run; an importer reads Claude and Codex files to backfill such gaps and to bring in sessions started outside ivin.
