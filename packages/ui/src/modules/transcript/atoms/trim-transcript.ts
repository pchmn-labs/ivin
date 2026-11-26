import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { serverRuntime } from "../../../core/server-client.ts"
import { isSubagentStep } from "../rules/turns.ts"
import { PAGE_SIZE, transcriptOf } from "./get-items.ts"

export const trimTranscriptAtom = serverRuntime.fn<string>()(
  Effect.fnUntraced(function* (sessionId, get) {
    const { list, paging } = transcriptOf(sessionId)
    const items = get.registry.get(list.items)
    const lastDropped = items.filter((item) => !isSubagentStep(item)).at(-PAGE_SIZE - 1)
    if (lastDropped === undefined) return
    for (const item of items) {
      if (item.position > lastDropped.position) break
      yield* list.remove(item.id)
    }
    yield* Atom.update(paging, (w) => ({ ...w, hasBefore: true }))
  }),
)
