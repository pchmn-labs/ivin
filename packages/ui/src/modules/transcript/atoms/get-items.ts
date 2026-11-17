import { Effect, Stream } from "effect"
import { Atom } from "effect/reactivity"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { makeEntityList } from "@ivin/state/entity-list"
import { strongFamily } from "@ivin/state/strong-family"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const PAGE_SIZE = 50

interface Paging {
  readonly loaded: boolean
  readonly hasBefore: boolean
  // Items added before the first one loaded; the virtual list needs it to keep its scroll anchor.
  readonly prepended: number
}

export const transcriptOf = strongFamily((sessionId: string) => {
  const paging = Atom.make<Paging>({ loaded: false, hasBefore: false, prepended: 0 })
  const list = makeEntityList({
    id: (item: TranscriptItem) => item.id,
    compare: (a, b) => a.position - b.position,
    feed: {
      runtime: serverRuntime,
      run: (writer) =>
        Effect.gen(function* () {
          const client = yield* ServerClient
          yield* client["transcript.watchItems"]({ sessionId, before: PAGE_SIZE }).pipe(
            Stream.runForEach((change) =>
              change.type === "upsert"
                ? writer.upsert([change.item])
                : writer.upsert(change.page.items).pipe(
                    Effect.andThen(
                      Atom.update(paging, (w) => ({
                        ...w,
                        loaded: true,
                        hasBefore: change.page.hasBefore,
                      })),
                    ),
                  ),
            ),
          )
        }),
    },
  })
  // Reading `paging` first keeps it alive before the feed, which sets it, starts.
  const items = Atom.readable((get) =>
    get(list.ids).flatMap((id) => {
      const item = get(list.item(id))
      return item ? [item] : []
    }),
  )
  // Usage items feed the status line and have no row; the same array while the ids are the same keeps the list from re-rendering.
  let rowIds: ReadonlyArray<string> = []
  const visibleIds = Atom.readable((get) => {
    const next = get(list.ids).filter((id) => get(list.item(id))?.type !== "usage")
    if (next.length === rowIds.length && next.every((id, i) => id === rowIds[i])) return rowIds
    rowIds = next
    return next
  })
  const view = Atom.readable((get) => ({ ...get(paging), ids: get(visibleIds) }))
  return { list, paging, view, items }
})
