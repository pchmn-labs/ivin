import type { HarnessOutput } from "@ivin/contracts/transcript"
import { Effect, type Scope, Stream } from "effect"
import { expect, test } from "vitest"
import { type ApprovalDecision, HarnessProvider } from "../../../shared/harness-provider.ts"
import {
  layerScripted,
  scriptedFailure,
  type ScriptedElement,
  type ScriptedSend,
} from "./scripted-provider.ts"

const text = (value: string): HarnessOutput => ({ type: "assistant_text", text: value, raw: null })

const run = <A, E>(
  turns: readonly (readonly ScriptedElement[])[],
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

test("interrupt is recorded and offers an interruption then an idle status", async () => {
  const interrupted: string[] = []
  const events = await Effect.runPromise(
    Effect.gen(function* () {
      const harness = yield* (yield* HarnessProvider).start({
        sessionId: "s1",
        cwd: "/p",
        model: "m",
        providerSessionId: null,
      })
      yield* harness.interrupt
      return yield* Stream.runCollect(Stream.take(harness.events, 2))
    }).pipe(Effect.provide(layerScripted([], { interrupted })), Effect.scoped),
  )

  expect(interrupted).toEqual(["s1"])
  expect(events.map((e) => e.type)).toEqual(["interruption", "status"])
})

test("a scripted failure fails the events stream at that point, after the events before it", async () => {
  const outcome = await run(
    [[text("one"), scriptedFailure("Boom"), text("never")]],
    [],
    (provider) =>
      Effect.gen(function* () {
        const harness = yield* provider.start({
          sessionId: "s1",
          cwd: "/p",
          model: "m",
          providerSessionId: null,
        })
        yield* harness.send({ text: "go" })
        const seen: string[] = []
        const error = yield* Stream.runForEach(harness.events, (e) =>
          Effect.sync(() => void seen.push(e.type)),
        ).pipe(Effect.flip)
        return { seen, message: error.message }
      }),
  )

  expect(outcome).toEqual({ seen: ["assistant_text"], message: "Boom" })
})

test("a start failure fails start, and closing the scope is reported", async () => {
  const closed: string[] = []
  await Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* HarnessProvider
      yield* provider.start({ sessionId: "s1", cwd: "/p", model: "m", providerSessionId: null })
    }).pipe(Effect.provide(layerScripted([], { closed })), Effect.scoped),
  )
  expect(closed).toEqual(["s1"])

  const error = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* Effect.flip(
        (yield* HarnessProvider).start({
          sessionId: "s1",
          cwd: "/p",
          model: "m",
          providerSessionId: null,
        }),
      )
    }).pipe(Effect.provide(layerScripted([], { startFailure: "No agent" })), Effect.scoped),
  )
  expect(error.message).toBe("No agent")
})
