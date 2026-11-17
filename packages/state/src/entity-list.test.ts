import { Effect } from "effect"
import { AtomRegistry } from "effect/reactivity"
import { expect, test } from "vitest"
import { makeEntityList } from "./entity-list.ts"

interface Row {
  readonly id: string
  readonly rank: number
  readonly label: string
}

const row = (id: string, rank: number, label = id): Row => ({ id, rank, label })
const make = () => makeEntityList<Row>({ id: (r) => r.id, compare: (a, b) => a.rank - b.rank })
const run = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  effect: Effect.Effect<A, E, AtomRegistry.AtomRegistry>,
) => Effect.runPromise(effect.pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)))

test("upserts keep ids sorted and replace an item in place", async () => {
  const registry = AtomRegistry.make()
  const list = make()
  registry.mount(list.ids)
  await run(registry, list.upsert([row("b", 2), row("a", 1), row("c", 3)]))
  expect(registry.get(list.ids)).toEqual(["a", "b", "c"])

  const ids = registry.get(list.ids)
  await run(registry, list.upsert([row("b", 2, "renamed")]))
  expect(registry.get(list.ids)).toBe(ids)
  expect(registry.get(list.item("b"))?.label).toBe("renamed")

  await run(registry, list.upsert([row("a", 9)]))
  expect(registry.get(list.ids)).toEqual(["b", "c", "a"])
})

test("an upsert of one item leaves the other item atoms untouched", async () => {
  const registry = AtomRegistry.make()
  const list = make()
  registry.mount(list.ids)
  await run(registry, list.upsert([row("a", 1), row("b", 2)]))
  const seen: Array<string> = []
  registry.subscribe(list.item("a"), (r) => seen.push(`a:${r?.label}`))
  registry.subscribe(list.item("b"), (r) => seen.push(`b:${r?.label}`))
  await run(registry, list.upsert([row("b", 2, "changed")]))
  expect(seen).toEqual(["b:changed"])
})
