import type { HarnessOutput } from "@ivin/contracts/transcript"
import { Effect, type Scope, Stream } from "effect"
import { expect, test } from "vitest"
import { type RequestAnswer, HarnessProvider } from "../../../shared/harness-provider.ts"
import {
  layerScripted,
  scriptedFailure,
  scriptedRead,
  type ScriptedElement,
  type ScriptedSend,
} from "./scripted-provider.ts"

const text = (value: string): HarnessOutput => ({ type: "assistant_text", text: value, raw: null })

const startS1 = (provider: HarnessProvider["Service"]) =>
  provider.start({
    sessionId: "s1",
    cwd: "/p",
    options: { model: "m", effort: "e", permissionMode: "p" },
    extraDirectories: [],
    providerSessionId: null,
  })

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
      const harness = yield* startS1(provider)
      yield* harness.send({ id: "m1", text: "hello", images: [] })
      yield* harness.send({ id: "m2", text: "again", images: [] })
      return yield* Stream.runCollect(Stream.take(harness.events, 3))
    }),
  )

  expect(events.map((e) => (e.type === "assistant_text" ? e.text : null))).toEqual([
    "one",
    "two",
    "three",
  ])
  expect(sent).toEqual([
    { sessionId: "s1", id: "m1", text: "hello", images: [] },
    { sessionId: "s1", id: "m2", text: "again", images: [] },
  ])
})

test("sending with no turn left fails", async () => {
  const error = await run([], [], (provider) =>
    Effect.gen(function* () {
      const harness = yield* startS1(provider)
      return yield* Effect.flip(harness.send({ id: "m3", text: "hello", images: [] }))
    }),
  )

  expect(error._tag).toBe("HarnessError")
})

test("with cycle, the turns start over once they are used up", async () => {
  const events = await Effect.runPromise(
    Effect.gen(function* () {
      const harness = yield* startS1(yield* HarnessProvider)
      yield* harness.send({ id: "m4", text: "a", images: [] })
      yield* harness.send({ id: "m5", text: "b", images: [] })
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
  const responded: RequestAnswer[] = []
  const events = await Effect.runPromise(
    Effect.gen(function* () {
      const harness = yield* startS1(yield* HarnessProvider)
      yield* harness.send({ id: "m6", text: "go", images: [] })
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

test("a turn pauses after a question request and resumes on its answers", async () => {
  const responded: RequestAnswer[] = []
  const answers = [{ question: "Which?", choices: ["A"] }]
  const events = await Effect.runPromise(
    Effect.gen(function* () {
      const harness = yield* startS1(yield* HarnessProvider)
      yield* harness.send({ id: "m8", text: "go", images: [] })
      const first = yield* Stream.runCollect(Stream.take(harness.events, 1))
      yield* harness.respond({ requestId: "q", answers })
      const second = yield* Stream.runCollect(Stream.take(harness.events, 1))
      return [first, second].map((chunk) => chunk.map((e) => e.type))
    }).pipe(
      Effect.provide(
        layerScripted(
          [
            [
              {
                type: "question_request",
                requestId: "q",
                toolCallId: null,
                questions: [],
                raw: null,
              },
              text("y"),
            ],
          ],
          { responded },
        ),
      ),
      Effect.scoped,
    ),
  )

  expect(events).toEqual([["question_request"], ["assistant_text"]])
  expect(responded).toEqual([{ requestId: "q", answers }])
})

test("responding with no paused turn fails", async () => {
  const error = await run([[text("x")]], [], (provider) =>
    Effect.gen(function* () {
      const harness = yield* startS1(provider)
      yield* harness.send({ id: "m7", text: "go", images: [] })
      return yield* Effect.flip(harness.respond({ requestId: "a", allow: true }))
    }),
  )

  expect(error._tag).toBe("HarnessError")
})

test("interrupt is recorded and offers an interruption then an idle status", async () => {
  const interrupted: string[] = []
  const events = await Effect.runPromise(
    Effect.gen(function* () {
      const harness = yield* startS1(yield* HarnessProvider)
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
        const harness = yield* startS1(provider)
        yield* harness.send({ id: "m8", text: "go", images: [] })
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
      yield* startS1(provider)
    }).pipe(Effect.provide(layerScripted([], { closed })), Effect.scoped),
  )
  expect(closed).toEqual(["s1"])

  const error = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* Effect.flip(startS1(yield* HarnessProvider))
    }).pipe(Effect.provide(layerScripted([], { startFailure: "No agent" })), Effect.scoped),
  )
  expect(error.message).toBe("No agent")
})

const running: HarnessOutput = { type: "status", status: "running", raw: null }
const idle: HarnessOutput = { type: "status", status: "idle", raw: null }
const asked = approval("r1")
const read = (messageId: string): HarnessOutput => ({ type: "message_read", messageId })

test("a message sent mid-turn waits, and the turn reads it where the script says", async () => {
  const sent: ScriptedSend[] = []
  const events = await run(
    [[running, asked, scriptedRead, text("noted"), idle]],
    sent,
    (provider) =>
      Effect.gen(function* () {
        const harness = yield* startS1(provider)
        yield* harness.send({ id: "m1", text: "go", images: [] })
        yield* harness.send({ id: "m2", text: "also", images: [] })
        yield* harness.respond({ requestId: "r1", allow: true })
        return yield* Stream.runCollect(Stream.take(harness.events, 5))
      }),
  )

  expect(events).toEqual([running, asked, read("m2"), text("noted"), idle])
  expect(sent.map((s) => s.id)).toEqual(["m1", "m2"])
})

test("messages still waiting when a turn ends are read, then start the next turn", async () => {
  const events = await run(
    [
      [running, asked, idle],
      [running, text("next"), idle],
    ],
    [],
    (provider) =>
      Effect.gen(function* () {
        const harness = yield* startS1(provider)
        yield* harness.send({ id: "m1", text: "go", images: [] })
        yield* harness.send({ id: "m2", text: "also", images: [] })
        yield* harness.send({ id: "m3", text: "and", images: [] })
        yield* harness.respond({ requestId: "r1", allow: true })
        return yield* Stream.runCollect(Stream.take(harness.events, 8))
      }),
  )

  expect(events).toEqual([
    running,
    asked,
    idle,
    read("m2"),
    read("m3"),
    running,
    text("next"),
    idle,
  ])
})

test("an interrupt ends the turn, and a waiting message starts the next one", async () => {
  const events = await run(
    [
      [running, asked],
      [running, text("next"), idle],
    ],
    [],
    (provider) =>
      Effect.gen(function* () {
        const harness = yield* startS1(provider)
        yield* harness.send({ id: "m1", text: "go", images: [] })
        yield* harness.send({ id: "m2", text: "also", images: [] })
        yield* harness.interrupt
        return yield* Stream.runCollect(Stream.take(harness.events, 7))
      }),
  )

  expect(events.map((e) => e.type)).toEqual([
    "status",
    "approval_request",
    "interruption",
    "status",
    "message_read",
    "status",
    "assistant_text",
  ])
})
