import { Effect } from "effect"
import { Atom, AtomRegistry, type AsyncResult } from "effect/reactivity"

interface EntityState<A> {
  readonly ids: ReadonlyArray<string>
  readonly byId: ReadonlyMap<string, A>
}

export interface EntityWriter<A> {
  // `keepExisting` is for a page that may be older than the stream updates already applied.
  readonly upsert: (
    items: ReadonlyArray<A>,
    options?: { readonly keepExisting?: boolean },
  ) => Effect.Effect<void, never, AtomRegistry.AtomRegistry>
  readonly remove: (id: string) => Effect.Effect<void, never, AtomRegistry.AtomRegistry>
  readonly get: (id: string) => Effect.Effect<A | undefined, never, AtomRegistry.AtomRegistry>
}

export interface EntityList<A> extends EntityWriter<A> {
  // Reading `ids` mounts the feed: the list is fed while something reads it.
  readonly ids: Atom.Atom<ReadonlyArray<string>>
  readonly item: (id: string) => Atom.Atom<A | undefined>
  readonly status: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown> | undefined>
}

const empty = { ids: [], byId: new Map() } as const

export const makeEntityList = <A, R = never, E = never, ER = never>(options: {
  readonly id: (item: A) => string
  readonly compare: (a: A, b: A) => number
  readonly feed?: {
    readonly runtime: Atom.AtomRuntime<R, ER>
    readonly run: (
      writer: EntityWriter<A>,
    ) => Effect.Effect<unknown, E, R | AtomRegistry.AtomRegistry>
  }
}): EntityList<A> => {
  const state = Atom.make<EntityState<A>>(empty)

  const insert = (ids: Array<string>, byId: Map<string, A>, item: A) => {
    let low = 0
    let high = ids.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if (options.compare(byId.get(ids[mid]!)!, item) <= 0) low = mid + 1
      else high = mid
    }
    ids.splice(low, 0, options.id(item))
  }

  const apply = (
    current: EntityState<A>,
    items: ReadonlyArray<A>,
    keepExisting: boolean,
  ): EntityState<A> => {
    const byId = new Map(current.byId)
    const ids = current.ids.slice()
    let changed = false
    let reordered = false
    for (const item of items) {
      const id = options.id(item)
      const existing = byId.get(id)
      if (existing !== undefined && keepExisting) continue
      changed = true
      if (existing !== undefined && options.compare(existing, item) === 0) {
        byId.set(id, item)
        continue
      }
      reordered = true
      if (existing !== undefined) ids.splice(ids.indexOf(id), 1)
      byId.set(id, item)
      insert(ids, byId, item)
    }
    return changed ? { ids: reordered ? ids : current.ids, byId } : current
  }

  const writer: EntityWriter<A> = {
    upsert: (items, upsertOptions) =>
      Atom.update(state, (s) => apply(s, items, upsertOptions?.keepExisting ?? false)),
    remove: (id) =>
      Atom.update(state, (s) => {
        if (!s.byId.has(id)) return s
        const byId = new Map(s.byId)
        byId.delete(id)
        return { ids: s.ids.filter((x) => x !== id), byId }
      }),
    get: (id) =>
      Effect.gen(function* () {
        const registry = yield* AtomRegistry.AtomRegistry
        return registry.get(state).byId.get(id)
      }),
  }

  const feed = options.feed?.runtime.atom(
    // Writing while the feed atom is still being built makes it rebuild itself.
    Effect.yieldNow.pipe(Effect.andThen(options.feed.run(writer))),
  )
  // Its own atom, so rebuilding `ids` on every upsert does not unmount and restart the feed.
  const live = Atom.readable((get) => {
    if (feed) get(feed)
  })
  const ids = Atom.readable((get) => {
    get(live)
    return get(state).ids
  })
  const item = Atom.family((id: string) => Atom.readable((get) => get(state).byId.get(id)))
  const status = Atom.readable((get) => (feed ? get(feed) : undefined))

  return { ...writer, ids, item, status }
}
