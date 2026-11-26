# Transcript

What the design adds to the [glossary](../../GLOSSARY.md)'s terms in the `transcript` module, on the server and in the UI. The design shared by every module is in [the architecture](README.md).

- Plugins render transcript items; they don't re-derive them from events.

## Stored items

- Each transcript item is stored in `transcript_items`, written in the same transaction as the event that creates or changes it. `transcript.getItems` and `transcript.watchItems` read only the items of the page asked for, never the events; a page counts and holds only the main agent's items, since a subagent's steps load with its task through `transcript.getTaskItems`; `transcript.listImages` reads only the user messages.
- Every event and item read from the store is decoded with its contract schema. One that no longer matches is left out and logged once, so the rest of the transcript still shows; a field added since it was stored takes its default.
- `transcript.watchItems` gives the last page, then each change to the session's items. A watcher that falls behind (its own buffer holds 1024 changes) gets the last page again, then the open tool calls and requests older than it, and carries on.
- `transcript_item_states` holds, per session, the version of the derivation rules its items were derived with and the assistant message still open, so a writer started after a restart carries on from the stored items: a tool result or a decision still updates its item, and assistant text still joins the open message.
- A session whose items are absent or derived with older rules (`ITEMS_VERSION`) gets them derived from all its events on its next read or write, once. A change to the rules that alters stored items bumps that version. A tool call's `kind` is computed again on each read, so a change to the harness's tool table needs no new version.
- When a turn or a run ends with approvals or questions still open, a `request_unanswered` event closes each one: an approval's decision, or a question's status, becomes `unanswered`, and the running tool call the approval was for gets a failed `tool_result` ("Not run: the approval was not answered."). At startup, a session left working or waiting gets the same events, and a new run gives them to any request its session still holds open, such as one left by a run from before this event existed.

- `transcript.watchUsage` streams the session's total tokens and cost, summed in SQL over every stored `usage` item, then the new total after each one; a session without usage streams `null`. A plugin reads it through `useUsage`, so the total does not depend on which pages the window holds.

## In the window

- The window holds a window of items. A tab's transcript stays fed while the tab is open; when its view closes with the transcript left at its end (`place.atEnd`), the items before the last page (`PAGE_SIZE`, 50, counted like the server's page) are removed and `hasBefore` is set, so reopening starts on the last item and scrolling up loads older pages again. A transcript left scrolled back keeps every page it has. The view that is on screen is never trimmed: its rows above the viewport would move under the reader.
- A transcript whose feed fails shows "The transcript could not be loaded." with Retry at the top of the transcript area, over a faint grey skeleton, in place of "Loading the transcript…". When the session is no longer in its project, it shows "This session no longer exists." with no Retry. Retry starts the feed again and keeps the items already loaded.

- A transcript already in the window holds image references from before a delete from the settings. `transcript.deleteImages` returns the ids it deleted, and the window keeps them for as long as it runs (`deletedImageIdsAtom`), so those images show as deleted without reloading the transcript; a reference read after the delete carries `deleted` itself.

- Two polite live regions speak for the transcript (`transcript/ui/announcements.tsx`): the end of a turn in the session on screen, read from the items once its status leaves working or waiting, and each new approval in the selected project, read from the sessions waiting for one. The approvals already waiting when a project's sessions first list are not announced.

- A background task's detail is the `tool-calls/task` view (params `{ taskId, kind, description }`; the kind and the description give its tab's icon and title before it mounts), placements `sheet` and `subView`, default `sheet`, `restore: false`. A task's Details or Output pill opens it through `view/atoms/open-view.ts`, only on click, so the rows of the transcript list read no view state but whether their task's view is the one shown (`taskShownOf`). The plugin reads the task through `useTask` and a command's output through `useTaskOutput` (read again every second while it runs); a subagent's run is the host component `TaskRun`, the transcript's own turn drawing, fed by `transcript.getTaskItems` and the live items whose `parentToolCallId` is the task's call. It draws the task item's `prompt` (set from the harness's `task_started`) as a bubble above the run; a subagent's closing report is an `assistant_text` under that call, made by the harness.

## Owning the transcript

- Codex and ACP have no equivalent of Claude's JSONL, and annotations and plugins need event ids that don't depend on a provider's file.
- Plugins, search and the UI read one store with one shape, whatever the harness, and ivin keeps events providers drop or rewrite (approvals, steering, interruptions, timings).
- Providers keep their own files for resuming: ivin stores the provider's session id (Claude `--resume`, Codex thread id, ACP session id) and resumes through it. ivin's copy is for display and plugins, never fed back to the agent.
- When the two diverge (a session resumed in a terminal, a Claude `/compact`), the provider's files win for the agent and ivin appends what it sees on the next run; an importer reads Claude and Codex files to backfill such gaps and to bring in sessions started outside ivin.
