import { Deferred, Effect } from "effect"
import { AtomRegistry } from "effect/reactivity"
import { expect, test } from "vitest"
import { makeEntityList } from "./entity-list.ts"
import { optimistic } from "./optimistic.ts"

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

test("optimistic applies at once, reconciles with the answer and rolls back on failure", async () => {
  const registry = AtomRegistry.make()
  const list = make()
  registry.mount(list.ids)
  const write = (answer: Effect.Effect<Row, "boom">) =>
    optimistic<Row>({
      apply: list.upsert([row("x", 1, "pending")]),
      rollback: list.remove("x"),
      reconcile: (server) => list.upsert([server]),
    })(answer)

  const gate = Deferred.makeUnsafe<Row>()
  const pending = run(registry, write(Deferred.await(gate)))
  await expect.poll(() => registry.get(list.item("x"))?.label).toBe("pending")
  Deferred.doneUnsafe(gate, Effect.succeed(row("x", 1, "saved")))
  await pending
  expect(registry.get(list.item("x"))?.label).toBe("saved")

  await run(registry, list.remove("x"))
  await run(registry, write(Effect.fail("boom")).pipe(Effect.ignore))
  expect(registry.get(list.ids)).toEqual([])
})
