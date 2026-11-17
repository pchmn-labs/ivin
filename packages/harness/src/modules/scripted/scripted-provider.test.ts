import type { HarnessEvent } from "@ivin/contracts/transcript"
import { Effect, type Scope, Stream } from "effect"
import { expect, test } from "vitest"
import { HarnessProvider } from "../../shared/harness-provider.ts"
import { layerScripted, type ScriptedSend } from "./scripted-provider.ts"

const text = (value: string): HarnessEvent => ({ type: "assistant_text", text: value, raw: null })

const run = <A, E>(
  turns: readonly (readonly HarnessEvent[])[],
  sent: ScriptedSend[],
  use: (provider: HarnessProvider["Service"]) => Effect.Effect<A, E, Scope.Scope>,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* use(yield* HarnessProvider)
    }).pipe(Effect.provide(layerScripted(turns, sent)), Effect.scoped),
  )

test("each send replays the next turn on the events stream and records what was sent", async () => {
  const sent: ScriptedSend[] = []
  const events = await run([[text("one"), text("two")], [text("three")]], sent, (provider) =>
    Effect.gen(function* () {
      const harness = yield* provider.start({ sessionId: "s1", cwd: "/p" })
      yield* harness.send({ text: "hello" })
      yield* harness.send({ text: "again" })
      return yield* Stream.runCollect(Stream.take(harness.events, 3))
    }),
  )

  expect(events.map((e) => (e.type === "assistant_text" ? e.text : null))).toEqual([
    "one",
    "two",
    "three",
  ])
  expect(sent).toEqual([
    { sessionId: "s1", text: "hello" },
    { sessionId: "s1", text: "again" },
  ])
})

test("sending with no turn left fails", async () => {
  const error = await run([], [], (provider) =>
    Effect.gen(function* () {
      const harness = yield* provider.start({ sessionId: "s1", cwd: "/p" })
      return yield* Effect.flip(harness.send({ text: "hello" }))
    }),
  )

  expect(error._tag).toBe("HarnessError")
})
