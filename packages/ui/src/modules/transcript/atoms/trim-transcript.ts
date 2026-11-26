import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { serverRuntime } from "../../../core/server-client.ts"
import { PAGE_SIZE, transcriptOf } from "./get-items.ts"

export const trimTranscriptAtom = serverRuntime.fn<string>()(
  Effect.fnUntraced(function* (sessionId, get) {
    const { list, paging } = transcriptOf(sessionId)
    const items = get.registry.get(list.items)
    // Counted like the server's page, which leaves out a subagent's steps.
    const topLevel = items.filter(
      (item) => !("parentToolCallId" in item) || item.parentToolCallId === undefined,
    )
    const firstKept = topLevel.at(-PAGE_SIZE)
    if (topLevel.length <= PAGE_SIZE || firstKept === undefined) return
    for (const item of items) {
      if (item.position >= firstKept.position) break
      yield* list.remove(item.id)
    }
    yield* Atom.update(paging, (w) => ({ ...w, hasBefore: true }))
  }),
)
