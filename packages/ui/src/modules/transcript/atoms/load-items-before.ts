import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { PAGE_SIZE, transcriptOf } from "./get-items.ts"

export const loadItemsBeforeAtom = serverRuntime.fn<string>()(
  Effect.fnUntraced(function* (sessionId, get) {
    const client = yield* ServerClient
    const { list, paging } = transcriptOf(sessionId)
    const firstId = get.registry.get(list.ids)[0]
    const first = firstId === undefined ? undefined : yield* list.get(firstId)
    if (first === undefined) return

    const page = yield* client["transcript.getItems"]({
      sessionId,
      position: first.position,
      before: PAGE_SIZE,
      after: 0,
    })
    yield* list.upsert(page.items, { keepExisting: true })
    yield* Atom.update(paging, (w) => ({ ...w, hasBefore: page.hasBefore }))
  }),
)
