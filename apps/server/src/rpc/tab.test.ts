import type { ScriptedElement } from "@ivin/harness"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import { Effect, Stream } from "effect"
import type { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { newDatabase, withServer as withTestServer, type Client } from "./test-server.ts"
import { until } from "./test-waits.ts"

interface Harness {
  readonly settings?: ReadonlyArray<string | null>
  readonly turns?: readonly (readonly ScriptedElement[])[]
  // Receives the session id of each run whose agent stopped.
  readonly closed?: string[]
}

const withServer = <A, E>(
  db: DatabaseSync,
  use: (client: Client) => Effect.Effect<A, E>,
  { settings = [], turns = [], closed = [] }: Harness = {},
) => withTestServer(use, { db, settings, turns, scripted: { closed } })

const newSession = (client: Client, projectPath: string) =>
  client["session.create"]({ projectPath })

test("opening a tab for a session twice yields one tab", async () => {
  const { first, second } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/a/first" })
      const session = yield* newSession(client, "/a/first")
      const first = yield* client["tab.open"]({ sessionId: session.id })
      return { first, second: yield* client["tab.open"]({ sessionId: session.id }) }
    }),
  )

  expect(second).toEqual(first)
  expect(second.tabs).toHaveLength(1)
  expect(second.selectedSessionId).toBe(second.tabs[0]!.sessionId)
})

test("a new tab goes at the end of its project's bar and is selected; reopening an earlier one only selects it", async () => {
  const { ids, bar, again } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/a/first" })
      const ids: string[] = []
      for (let i = 0; i < 3; i++) ids.push((yield* newSession(client, "/a/first")).id)
      let bar
      for (const sessionId of ids) bar = yield* client["tab.open"]({ sessionId })
      if (bar === undefined) return yield* Effect.die("no tab opened")
      return { ids, bar, again: yield* client["tab.open"]({ sessionId: ids[0]! }) }
    }),
  )

  expect(bar.tabs.map((t) => t.sessionId)).toEqual(ids)
  expect(bar.selectedSessionId).toBe(ids[2])
  expect(again.tabs.map((t) => t.sessionId)).toEqual(ids)
  expect(again.selectedSessionId).toBe(ids[0])
})

test("a new tab opened with `after` goes right after that tab; a session that has a tab keeps its place", async () => {
  const { ids, added, bar, again } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/a/first" })
      const ids: string[] = []
      for (let i = 0; i < 3; i++) ids.push((yield* newSession(client, "/a/first")).id)
      for (const sessionId of ids) yield* client["tab.open"]({ sessionId })
      const added = yield* newSession(client, "/a/first")
      const bar = yield* client["tab.open"]({ sessionId: added.id, after: ids[0]! })
      const again = yield* client["tab.open"]({ sessionId: ids[2]!, after: ids[0]! })
      return { ids, added, bar, again }
    }),
  )

  const order = [ids[0], added.id, ids[1], ids[2]]
  expect(bar.tabs.map((t) => t.sessionId)).toEqual(order)
  expect(bar.selectedSessionId).toBe(added.id)
  expect(again.tabs.map((t) => t.sessionId)).toEqual(order)
})

test("a tab of another project goes to that project's bar", async () => {
  const { a, b } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/a/first" })
      yield* client["project.open"]({ path: "/a/second" })
      yield* client["tab.open"]({ sessionId: (yield* newSession(client, "/a/first")).id })
      yield* client["tab.open"]({ sessionId: (yield* newSession(client, "/a/second")).id })
      return {
        a: yield* client["tab.list"]({ projectPath: "/a/first" }),
        b: yield* client["tab.list"]({ projectPath: "/a/second" }),
      }
    }),
  )

  expect(a.tabs.map((t) => t.projectPath)).toEqual(["/a/first"])
  expect(b.tabs.map((t) => t.projectPath)).toEqual(["/a/second"])
})

test("opening a tab fails for an unknown session and for a project that is not open", async () => {
  const { unknown, closed } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const session = yield* newSession(client, "/a/never-opened")
      return {
        unknown: yield* Effect.flip(client["tab.open"]({ sessionId: "nope" })),
        closed: yield* Effect.flip(client["tab.open"]({ sessionId: session.id })),
      }
    }),
  )

  expect(unknown._tag).toBe("SessionNotFound")
  expect(closed._tag).toBe("ProjectNotOpen")
})

const barOf = (client: Client, count: number) =>
  Effect.gen(function* () {
    yield* client["project.open"]({ path: "/a/first" })
    const ids: string[] = []
    for (let i = 0; i < count; i++) {
      const session = yield* newSession(client, "/a/first")
      yield* client["tab.open"]({ sessionId: session.id })
      ids.push(session.id)
    }
    return ids
  })

test.each([
  ["a selected tab selects the next one", 1, 2],
  ["the selected last tab selects the previous one", 2, 1],
])("closing %s", async (_, closing, expected) => {
  const { ids, closed } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const ids = yield* barOf(client, 3)
      yield* client["tab.open"]({ sessionId: ids[closing]! })
      return { ids, closed: yield* client["tab.close"]({ sessionId: ids[closing]! }) }
    }),
  )

  expect(closed.tabs.map((t) => t.sessionId)).not.toContain(ids[closing])
  expect(closed.selectedSessionId).toBe(ids[expected])
})

test("closing an unselected tab keeps the selection, and closing the last tab selects none", async () => {
  const { kept, none } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const ids = yield* barOf(client, 2)
      const kept = yield* client["tab.close"]({ sessionId: ids[0]! })
      const none = yield* client["tab.close"]({ sessionId: ids[1]! })
      return { kept: { ...kept, last: ids[1] }, none }
    }),
  )

  expect(kept.selectedSessionId).toBe(kept.last)
  expect(none.tabs).toEqual([])
  expect(none.selectedSessionId).toBeNull()
})

test("closing a tab of an unknown session fails", async () => {
  const error = await withServer(newDatabase(), (client) =>
    Effect.flip(client["tab.close"]({ sessionId: "nope" })),
  )

  expect(error._tag).toBe("SessionNotFound")
})

test("tabs, their order and each project's selected tab are back after a restart on the same database", async () => {
  const db = newDatabase()
  const ids = await withServer(db, (client) =>
    Effect.gen(function* () {
      const ids = yield* barOf(client, 3)
      yield* client["tab.reorder"]({ projectPath: "/a/first", sessionIds: [ids[2]!, ids[1]!] })
      yield* client["tab.open"]({ sessionId: ids[1]! })
      yield* client["project.open"]({ path: "/a/second" })
      const other = yield* newSession(client, "/a/second")
      yield* client["tab.open"]({ sessionId: other.id })
      return { ids, other: other.id }
    }),
  )

  const { first, second, open } = await withServer(db, (client) =>
    Effect.gen(function* () {
      return {
        first: yield* client["tab.list"]({ projectPath: "/a/first" }),
        second: yield* client["tab.list"]({ projectPath: "/a/second" }),
        open: yield* client["project.list"](),
      }
    }),
  )

  expect(first.tabs.map((t) => t.sessionId)).toEqual([ids.ids[2], ids.ids[1], ids.ids[0]])
  expect(first.selectedSessionId).toBe(ids.ids[1])
  expect(second.tabs.map((t) => t.sessionId)).toEqual([ids.other])
  expect(second.selectedSessionId).toBe(ids.other)
  expect(open.selectedPath).toBe("/a/second")
})

const running: HarnessOutput = { type: "status", status: "running", raw: null }
const working = [running, { type: "assistant_text", text: "Working", raw: null }] as const

const statusOf = (client: Client, sessionId: string) =>
  client["session.list"]({ projectPath: "/a/first" }).pipe(
    Effect.map((sessions) => sessions.find((s) => s.id === sessionId)?.status),
  )

const currentSettings = (client: Client) =>
  client["setting.watch"]().pipe(
    Stream.take(1),
    Stream.runHead,
    Effect.map((head) => (head._tag === "Some" ? head.value : null)),
  )

// Closes the tab of a session whose agent is working, once the settings file has been read.
const closeWorkingTab = (settings: ReadonlyArray<string | null>, stopAgentOnClose: boolean) => {
  const closed: string[] = []
  return withServer(
    newDatabase(),
    (client) =>
      Effect.gen(function* () {
        yield* until(
          currentSettings(client),
          (current) =>
            current !== null && current.settings.tabs.stopAgentOnClose === stopAgentOnClose,
        )
        const [sessionId] = yield* barOf(client, 1)
        yield* client["session.sendMessage"]({
          sessionId: sessionId!,
          messageId: "m1",
          text: "go",
        })
        yield* until(statusOf(client, sessionId!), (status) => status === "working")
        const tabs = yield* client["tab.close"]({ sessionId: sessionId! })
        return {
          sessionId: sessionId!,
          tabs,
          status: yield* statusOf(client, sessionId!),
          closed: [...closed],
        }
      }),
    { settings, turns: [working], closed },
  )
}

test("closing a tab stops its session's agent, and the session is idle", async () => {
  const { sessionId, tabs, status, closed } = await closeWorkingTab([null], true)

  expect(tabs.tabs).toEqual([])
  expect(closed).toEqual([sessionId])
  expect(status).toBe("idle")
})

test("closing a tab leaves the agent running when settings.json turns stopping off", async () => {
  const { tabs, status, closed } = await closeWorkingTab(
    [`{ "tabs": { "stopAgentOnClose": false } }`],
    false,
  )

  expect(tabs.tabs).toEqual([])
  expect(closed).toEqual([])
  expect(status).toBe("working")
})

test("closing a project stops the agents of its tabs", async () => {
  const closed: string[] = []
  const { sessionId } = await withServer(
    newDatabase(),
    (client) =>
      Effect.gen(function* () {
        const [sessionId] = yield* barOf(client, 1)
        yield* client["session.sendMessage"]({
          sessionId: sessionId!,
          messageId: "m1",
          text: "go",
        })
        yield* until(statusOf(client, sessionId!), (status) => status === "working")
        yield* client["project.close"]({ path: "/a/first" })
        yield* until(statusOf(client, sessionId!), (status) => status === "idle")
        return { sessionId: sessionId! }
      }),
    { turns: [working], closed },
  )

  expect(closed).toEqual([sessionId])
})
