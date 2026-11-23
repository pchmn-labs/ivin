# Transcript

What the design adds to the [glossary](../../GLOSSARY.md)'s terms in the `transcript` module, on the server and in the UI. The design shared by every module is in [the architecture](README.md).

- Plugins render transcript items; they don't re-derive them from events.

## Owning the transcript

- Codex and ACP have no equivalent of Claude's JSONL, and annotations and plugins need event ids that don't depend on a provider's file.
- Plugins, search and the UI read one store with one shape, whatever the harness, and ivin keeps events providers drop or rewrite (approvals, steering, interruptions, timings).
- Providers keep their own files for resuming: ivin stores the provider's session id (Claude `--resume`, Codex thread id, ACP session id) and resumes through it. ivin's copy is for display and plugins, never fed back to the agent.
- When the two diverge (a session resumed in a terminal, a Claude `/compact`), the provider's files win for the agent and ivin appends what it sees on the next run; an importer reads Claude and Codex files to backfill such gaps and to bring in sessions started outside ivin.
