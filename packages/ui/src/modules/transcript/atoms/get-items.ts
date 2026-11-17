import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { makeEntityList } from "@ivin/state/entity-list"
import { feedFromPageAndStream } from "@ivin/state/stream-feed"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const PAGE_SIZE = 50

interface Window {
  readonly loaded: boolean
  readonly hasBefore: boolean
  // Items added before the first one loaded; the virtual list needs it to keep its scroll anchor.
  readonly prepended: number
}

export const transcriptOf = Atom.family((sessionId: string) => {
  const window = Atom.make<Window>({ loaded: false, hasBefore: false, prepended: 0 })
  const list = makeEntityList<TranscriptItem>({
    id: (item) => item.id,
    compare: (a, b) => a.position - b.position,
    feed: (writer) =>
      serverRuntime.atom(
        Effect.gen(function* () {
          // Writing to the atoms while the feed atom is still being built makes it rebuild itself.
          yield* Effect.yieldNow
          const client = yield* ServerClient
          yield* feedFromPageAndStream(writer, {
            updates: client["transcript.watchItems"]({ sessionId }),
            page: client["transcript.getItems"]({
              sessionId,
              position: null,
              before: PAGE_SIZE,
              after: 0,
            }).pipe(
              Effect.tap((page) =>
                Atom.update(window, (w) => ({ ...w, loaded: true, hasBefore: page.hasBefore })),
              ),
              Effect.map((page) => page.items),
            ),
          })
        }),
      ),
  })
  // Reading the window first keeps it alive before the feed, which sets it, starts.
  const view = Atom.readable((get) => ({ ...get(window), ids: get(list.ids) }))
  return { list, window, view }
})
