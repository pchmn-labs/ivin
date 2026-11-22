import { Effect, Stream } from "effect"
import { Atom, AtomRegistry } from "effect/reactivity"
import type { TranscriptDelta, TranscriptItem } from "@ivin/contracts/transcript"
import { makeFrameBatch } from "@ivin/state/frame-batch"
import { makeEntityList, type EntityWriter } from "@ivin/state/entity-list"
import { strongFamily } from "@ivin/state/strong-family"
import { foldDeltas } from "../rules/fold-deltas.ts"
import { stableRows } from "../rules/stable-rows.ts"
import { shownRows, transcriptRows, turnWork, type TranscriptRow } from "../rules/turns.ts"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

export const PAGE_SIZE = 50

const scheduleFrame = (run: () => void): void => {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run)
  else setTimeout(run, 16)
}

interface Paging {
  readonly loaded: boolean
  readonly hasBefore: boolean
}

const unloaded: Paging = { loaded: false, hasBefore: false }

const applyDeltas = (writer: EntityWriter<TranscriptItem>, batch: ReadonlyArray<TranscriptDelta>) =>
  Effect.gen(function* () {
    const held = new Map<string, TranscriptItem | undefined>()
    for (const { itemId } of batch) {
      if (!held.has(itemId)) held.set(itemId, yield* writer.get(itemId))
    }
    yield* writer.upsert(foldDeltas((id) => held.get(id), batch, Date.now()))
  })

export const transcriptOf = strongFamily((sessionId: string) => {
  // Kept alive: the feed writes it before anything reads it, and an unread node is dropped.
  const paging = Atom.keepAlive(Atom.make<Paging>(unloaded))
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
            // The list is dropped with the feed, so a page loaded before no longer describes it.
            Effect.onInterrupt(() => Atom.set(paging, unloaded)),
          )
        }),
    },
  })
  // The same rows while the turns keep their shape, so the list does not re-render.
  let shown: { rows: ReadonlyArray<TranscriptRow>; prepended: number } = { rows: [], prepended: 0 }
  const rows = Atom.readable((get) => {
    shown = stableRows(shown, transcriptRows(get(list.items)))
    return shown
  })
  const view = Atom.readable((get) => {
    // Read after the feed starts: its first write to `paging` would otherwise rebuild this atom, and the feed with it.
    const { rows: list, prepended } = get(rows)
    return { ...get(paging), rows: list, prepended }
  })
  // `live`: the session's agent is working.
  const work = Atom.family((live: boolean) =>
    Atom.family((rowId: string) =>
      Atom.readable((get) => {
        const row = shownRows(get(rows).rows, live).find((r) => r.id === rowId)
        if (row?.type !== "work") return null
        const items = (ids: ReadonlyArray<string>) =>
          ids.flatMap((id) => {
            const item = get(list.item(id))
            return item ? [item] : []
          })
        return turnWork(rowId, items(row.itemIds), items(row.turnIds))
      }),
    ),
  )
  return { list, paging, view, work }
})
