import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { serverRuntime } from "../../../core/server-client.ts"
import { PAGE_SIZE, transcriptOf } from "./get-items.ts"

export const trimTranscriptAtom = serverRuntime.fn<string>()(
  Effect.fnUntraced(function* (sessionId, get) {
    const { list, paging } = transcriptOf(sessionId)
    const dropped = get.registry.get(list.ids).slice(0, -PAGE_SIZE)
    if (dropped.length === 0) return
    for (const id of dropped) yield* list.remove(id)
    yield* Atom.update(paging, (w) => ({ ...w, hasBefore: true }))
  }),
)
