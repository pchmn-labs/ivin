import type { HarnessOutput } from "@ivin/contracts/transcript"
import { Effect, type Scope, Stream } from "effect"
import { expect, test } from "vitest"
import { type ApprovalDecision, HarnessProvider } from "../../../shared/harness-provider.ts"
import { layerScripted, type ScriptedSend } from "./scripted-provider.ts"

const text = (value: string): HarnessOutput => ({ type: "assistant_text", text: value, raw: null })

const run = <A, E>(
  turns: readonly (readonly HarnessOutput[])[],
  sent: ScriptedSend[],
  use: (provider: HarnessProvider["Service"]) => Effect.Effect<A, E, Scope.Scope>,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* use(yield* HarnessProvider)
    }).pipe(Effect.provide(layerScripted(turns, { sent })), Effect.scoped),
  )

test("each send replays the next turn on the events stream and records what was sent", async () => {
  const sent: ScriptedSend[] = []
  const events = await run([[text("one"), text("two")], [text("three")]], sent, (provider) =>
    Effect.gen(function* () {
      const harness = yield* provider.start({
        sessionId: "s1",
        cwd: "/p",
        model: "m",
        providerSessionId: null,
      })
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
      const harness = yield* provider.start({
        sessionId: "s1",
        cwd: "/p",
        model: "m",
        providerSessionId: null,
      })
      return yield* Effect.flip(harness.send({ text: "hello" }))
    }),
  )

  expect(error._tag).toBe("HarnessError")
})

test("with cycle, the turns start over once they are used up", async () => {
  const events = await Effect.runPromise(
    Effect.gen(function* () {
      const harness = yield* (yield* HarnessProvider).start({
        sessionId: "s1",
        cwd: "/p",
        model: "m",
        providerSessionId: null,
      })
      yield* harness.send({ text: "a" })
      yield* harness.send({ text: "b" })
      return yield* Stream.runCollect(Stream.take(harness.events, 2))
    }).pipe(Effect.provide(layerScripted([[text("only")]], { cycle: true })), Effect.scoped),
  )

  expect(events).toHaveLength(2)
})

const approval = (requestId: string): HarnessOutput => ({
  type: "approval_request",
  requestId,
  toolCallId: null,
  name: "Bash",
  input: {},
  raw: null,
})

test("a turn pauses after an approval request and resumes on each decision", async () => {
  const responded: ApprovalDecision[] = []
  const events = await Effect.runPromise(
    Effect.gen(function* () {
      const harness = yield* (yield* HarnessProvider).start({
        sessionId: "s1",
        cwd: "/p",
        providerSessionId: null,
        model: "m",
      })
      yield* harness.send({ text: "go" })
      const first = yield* Stream.runCollect(Stream.take(harness.events, 2))
      yield* harness.respond({ requestId: "a", allow: true })
      const second = yield* Stream.runCollect(Stream.take(harness.events, 2))
      yield* harness.respond({ requestId: "b", allow: false })
      const third = yield* Stream.runCollect(Stream.take(harness.events, 1))
      return [first, second, third].map((chunk) => chunk.map((e) => e.type))
    }).pipe(
      Effect.provide(
        layerScripted([[text("x"), approval("a"), text("y"), approval("b"), text("z")]], {
          responded,
        }),
      ),
      Effect.scoped,
    ),
  )

  expect(events).toEqual([
    ["assistant_text", "approval_request"],
    ["assistant_text", "approval_request"],
    ["assistant_text"],
  ])
  expect(responded).toEqual([
    { requestId: "a", allow: true },
    { requestId: "b", allow: false },
  ])
})

test("responding with no paused turn fails", async () => {
  const error = await run([[text("x")]], [], (provider) =>
    Effect.gen(function* () {
      const harness = yield* provider.start({
        sessionId: "s1",
        cwd: "/p",
        model: "m",
        providerSessionId: null,
      })
      yield* harness.send({ text: "go" })
      return yield* Effect.flip(harness.respond({ requestId: "a", allow: true }))
    }),
  )

  expect(error._tag).toBe("HarnessError")
})
