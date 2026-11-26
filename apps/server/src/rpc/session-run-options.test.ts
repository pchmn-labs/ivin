import type { HarnessOutput } from "@ivin/contracts/transcript"
import {
  scriptedFailure,
  scriptedRead,
  type ScriptedElement,
  type ScriptedOptions,
  type StartInput,
} from "@ivin/harness"
import { Effect } from "effect"
import type { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { idle, running, said, askedApproval as asked, itemsOf, sessionOf } from "./test-scripts.ts"
import { newDatabase, withServer as withTestServer, type Client } from "./test-server.ts"
import { until } from "./test-waits.ts"

const answered = (text: string): readonly HarnessOutput[] => [running, said(text), idle]

const defaults = { model: "scripted", effort: "low", permissionMode: "ask" }

const withServer = <A, E>(
  db: DatabaseSync,
  turns: readonly (readonly ScriptedElement[])[],
  use: (client: Client) => Effect.Effect<A, E>,
  options: ScriptedOptions = {},
) => withTestServer(use, { db, turns, scripted: { reportSession: true, ...options } })

const untilSaid = (client: Client, sessionId: string, text: string) =>
  until(itemsOf(client, sessionId), (items) =>
    items.some((item) => item.type === "message" && item.text === text),
  )

const untilIdle = (client: Client, sessionId: string) =>
  until(sessionOf(client, sessionId), (session) => session?.status === "idle")

test("a new session takes the harness's defaults, then the project's last run options", async () => {
  const sessions = await withServer(newDatabase(), [], (client) =>
    Effect.gen(function* () {
      const first = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.setRunOptions"]({
        sessionId: first.id,
        options: { model: "scripted-large", permissionMode: "auto" },
      })
      return {
        first,
        sameProject: yield* client["session.create"]({ projectPath: "/p" }),
        otherProject: yield* client["session.create"]({ projectPath: "/other" }),
      }
    }),
  )

  expect(sessions.first).toMatchObject(defaults)
  expect(sessions.sameProject).toMatchObject({
    model: "scripted-large",
    effort: "low",
    permissionMode: "auto",
  })
  expect(sessions.otherProject).toMatchObject(defaults)
})

test("a change while idle starts the next run with the new options and the stored provider session id", async () => {
  const starts: StartInput[] = []
  const closed: string[] = []
  const sessionId = await withServer(
    newDatabase(),
    [answered("one"), answered("two")],
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "a" })
        yield* untilIdle(client, session.id)
        yield* client["session.setRunOptions"]({
          sessionId: session.id,
          options: { model: "scripted-large", effort: "high" },
        })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m2", text: "b" })
        yield* untilSaid(client, session.id, "two")
        return session.id
      }),
    { starts, closed },
  )

  expect(starts.map((start) => start.options)).toEqual([
    defaults,
    { model: "scripted-large", effort: "high", permissionMode: "ask" },
  ])
  expect(starts[1]?.providerSessionId).toBe(`scripted-${sessionId}`)
  expect(closed[0]).toBe(sessionId)
})

test("a change while running leaves the running turn alone and applies to the next", async () => {
  const starts: StartInput[] = []
  await withServer(
    newDatabase(),
    [[running, said("working"), asked, scriptedRead, said("steered"), idle], answered("next")],
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "a" })
        yield* untilSaid(client, session.id, "working")
        yield* client["session.setRunOptions"]({
          sessionId: session.id,
          options: { model: "scripted-large" },
        })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m2", text: "b" })
        yield* client["session.answerApproval"]({
          sessionId: session.id,
          requestId: "r1",
          allow: true,
        })
        yield* untilSaid(client, session.id, "steered")
        expect(starts).toHaveLength(1)
        yield* untilIdle(client, session.id)
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m3", text: "c" })
        yield* untilSaid(client, session.id, "next")
      }),
    { starts },
  )

  expect(starts.map((start) => start.options.model)).toEqual(["scripted", "scripted-large"])
})

test("a change before the first message appends no transcript line", async () => {
  const { changed, items } = await withServer(newDatabase(), [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const changed = yield* client["session.setRunOptions"]({
        sessionId: session.id,
        options: { effort: "high" },
      })
      return { changed, items: yield* itemsOf(client, session.id) }
    }),
  )

  expect(changed.effort).toBe("high")
  expect(items).toEqual([])
})

test("each change appends a transcript line naming the old and the new value", async () => {
  const items = await withServer(newDatabase(), [answered("one")], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "a" })
      yield* untilIdle(client, session.id)
      yield* client["session.setRunOptions"]({
        sessionId: session.id,
        options: { model: "scripted", effort: "high", permissionMode: "auto" },
      })
      return yield* itemsOf(client, session.id)
    }),
  )

  expect(items.filter((item) => item.type === "run_option")).toMatchObject([
    {
      type: "run_option",
      option: "effort",
      from: "low",
      to: "high",
      fromName: "Low",
      toName: "High",
    },
    {
      type: "run_option",
      option: "permissionMode",
      from: "ask",
      to: "auto",
      fromName: "Ask",
      toName: "Auto",
    },
  ])
})

test("run options survive a server restart and start the next run", async () => {
  const db = newDatabase()
  const starts: StartInput[] = []
  const sessionId = await withServer(db, [], (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* client["session.setRunOptions"]({
        sessionId: session.id,
        options: { effort: "high", permissionMode: "auto" },
      })
      return session.id
    }),
  )

  const listed = await withServer(
    db,
    [answered("one")],
    (client) =>
      Effect.gen(function* () {
        const session = yield* sessionOf(client, sessionId)
        yield* client["session.sendMessage"]({ sessionId, messageId: "m1", text: "a" })
        yield* untilSaid(client, sessionId, "one")
        return session
      }),
    { starts },
  )

  expect(listed).toMatchObject({ model: "scripted", effort: "high", permissionMode: "auto" })
  expect(starts[0]?.options).toEqual({ model: "scripted", effort: "high", permissionMode: "auto" })
})

const failedTurn: readonly ScriptedElement[] = [
  running,
  { type: "error", message: "There's an issue with the selected model", raw: null },
  idle,
]

test.each([
  ["ends its first turn with an error", failedTurn, "There's an issue with the selected model"],
  ["stops before its first turn ends", [running, scriptedFailure("exit code 1")], "exit code 1"],
])(
  "a run started after a change that %s offers the previous options back, with the message and the error",
  async (_, turn, error) => {
    const { failed, after } = await withServer(newDatabase(), [answered("one"), turn], (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "a" })
        yield* untilIdle(client, session.id)
        yield* client["session.setRunOptions"]({
          sessionId: session.id,
          options: { model: "not-a-model" },
        })
        yield* client["session.sendMessage"]({
          sessionId: session.id,
          messageId: "m2",
          text: "again",
        })
        const failed = yield* until(
          sessionOf(client, session.id),
          (listed) => listed?.relaunchFailure != null,
        )
        const after = yield* client["session.setRunOptions"]({
          sessionId: session.id,
          options: { model: "scripted" },
        })
        return { failed, after }
      }),
    )

    expect(failed?.relaunchFailure).toEqual({ previous: defaults, message: "again", error })
    expect(after.relaunchFailure).toBeNull()
  },
)

test("changing the run options of a missing session fails with SessionNotFound", async () => {
  const error = await withServer(newDatabase(), [], (client) =>
    client["session.setRunOptions"]({ sessionId: "nope", options: { model: "x" } }).pipe(
      Effect.flip,
    ),
  )

  expect(error._tag).toBe("SessionNotFound")
})
