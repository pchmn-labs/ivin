import { Effect, Stream } from "effect"
import { Atom, AtomRegistry } from "effect/reactivity"
import type { TranscriptDelta, TranscriptItem } from "@ivin/contracts/transcript"
import { makeFrameBatch } from "@ivin/state/frame-batch"
import { makeEntityList, type EntityWriter } from "@ivin/state/entity-list"
import { strongFamily } from "@ivin/state/strong-family"
import { foldDeltas } from "../rules/fold-deltas.ts"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const PAGE_SIZE = 50

const scheduleFrame = (run: () => void): void => {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run)
  else setTimeout(run, 16)
}

interface Paging {
  readonly loaded: boolean
  readonly hasBefore: boolean
  // Items added before the first one loaded; the virtual list needs it to keep its scroll anchor.
  readonly prepended: number
}

const applyDeltas = (writer: EntityWriter<TranscriptItem>, batch: ReadonlyArray<TranscriptDelta>) =>
  Effect.gen(function* () {
    const held = new Map<string, TranscriptItem | undefined>()
    for (const { itemId } of batch) {
      if (!held.has(itemId)) held.set(itemId, yield* writer.get(itemId))
    }
    yield* writer.upsert(foldDeltas((id) => held.get(id), batch))
  })

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
          const registry = yield* AtomRegistry.AtomRegistry
          const deltas = makeFrameBatch<TranscriptDelta>({
            schedule: scheduleFrame,
            flush: (batch) =>
              Effect.runFork(
                applyDeltas(writer, batch).pipe(
                  Effect.provideService(AtomRegistry.AtomRegistry, registry),
                ),
              ),
          })
          // Stored items replace the provisional text, so their pending deltas are stale.
          const dropDeltasOf = (items: ReadonlyArray<TranscriptItem>) => {
            const ids = new Set(items.map((item) => item.id))
            deltas.drop((delta) => ids.has(delta.itemId))
          }

          yield* client["transcript.watchItems"]({ sessionId, before: PAGE_SIZE }).pipe(
            Stream.runForEach((change) => {
              if (change.type === "delta") {
                deltas.push(change)
                return Effect.void
              }
              if (change.type === "upsert") {
                dropDeltasOf([change.item])
                return writer.upsert([change.item])
              }
              dropDeltasOf(change.page.items)
              return writer.upsert(change.page.items).pipe(
                Effect.andThen(
                  Atom.update(paging, (w) => ({
                    ...w,
                    loaded: true,
                    hasBefore: change.page.hasBefore,
                  })),
                ),
              )
            }),
          )
        }),
    },
  })
  // Reading `paging` first keeps it alive before the feed, which sets it, starts.
  // Usage items feed the status line and have no row; the same array while the ids are the same keeps the list from re-rendering.
  let rowIds: ReadonlyArray<string> = []
  const visibleIds = Atom.readable((get) => {
    const next = get(list.ids).filter((id) => get(list.item(id))?.type !== "usage")
    if (next.length === rowIds.length && next.every((id, i) => id === rowIds[i])) return rowIds
    rowIds = next
    return next
  })
  const view = Atom.readable((get) => ({ ...get(paging), ids: get(visibleIds) }))
  return { list, paging, view }
})
