import type { HarnessOutput } from "@ivin/contracts/transcript"
import { HarnessError } from "@ivin/harness"
import { Deferred, Effect } from "effect"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { makeClient, serverLayer, type Client } from "./test-server.ts"
import { layerErrorLogFile } from "../modules/log/adapters/error-log-file.ts"
import { FirstMessageReading } from "../modules/session/usecases/first-message-reading.ts"

const turn: readonly HarnessOutput[] = [
  { type: "status", status: "running", raw: null },
  { type: "status", status: "idle", raw: null },
]

const withServer = <A, E>(
  completeText: (prompt: string) => Effect.Effect<string, HarnessError>,
  use: (client: Client) => Effect.Effect<A, E, FirstMessageReading>,
  logPath = join(mkdtempSync(join(tmpdir(), "ivin-log-")), "ivin.log"),
) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(serverLayer({ turns: [turn], scripted: { cycle: true, completeText } })),
      Effect.scoped,
      Effect.provide(layerErrorLogFile(logPath)),
    ),
  )

const reply = (json: object) => () => Effect.succeed(JSON.stringify(json))

const sendFirst = (client: Client, sessionId: string, text: string) =>
  Effect.gen(function* () {
    yield* client["session.sendMessage"]({ sessionId, messageId: crypto.randomUUID(), text })
    yield* (yield* FirstMessageReading).settled
    const listed = yield* client["session.list"]({ projectPath: "/p" })
    const citations = yield* client["annotation.list"]({
      target: { _tag: "session", sessionId },
      kind: "citation",
    })
    return {
      title: listed.find(({ id }) => id === sessionId)!.title,
      citations: citations.map(({ ns, data }) => ({ ns, data })),
    }
  })

const firstMessage = (client: Client, text: string) =>
  Effect.gen(function* () {
    const session = yield* client["session.create"]({ projectPath: "/p" })
    return { sessionId: session.id, ...(yield* sendFirst(client, session.id, text)) }
  })

test("the first message's title is replaced by the one the model writes from it, and the issue number it names is stored as a citation", async () => {
  const prompts: string[] = []
  const run = await withServer(
    (prompt) => {
      prompts.push(prompt)
      return Effect.succeed(
        '{"title": "Keybindings grouped in settings", "workItem": {"kind": "issue", "number": 127}}',
      )
    },
    (client) =>
      firstMessage(
        client,
        "/prototype the settings page should list keybindings by group, see mock, implement #127",
      ),
  )

  expect(run.title).toBe("Keybindings grouped in settings")
  expect(run.citations).toEqual([{ ns: "ivin", data: { kind: "issue", number: 127 } }])
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toContain("the settings page should list keybindings by group")
})

test("a title the user or the agent gives before the generated one arrives stays", async () => {
  let gate: Deferred.Deferred<void> | undefined
  const titles = await withServer(
    () => Effect.suspend(() => Deferred.await(gate!)).pipe(Effect.as('{"title": "Generated"}')),
    (client) =>
      Effect.gen(function* () {
        const kept = []
        for (const by of ["user", "agent"] as const) {
          gate = yield* Deferred.make<void>()
          const session = yield* client["session.create"]({ projectPath: "/p" })
          yield* client["session.sendMessage"]({
            sessionId: session.id,
            messageId: crypto.randomUUID(),
            text: "fix the drag",
          })
          yield* client["session.rename"]({ sessionId: session.id, title: `By ${by}`, by })
          yield* Deferred.succeed(gate, undefined)
          yield* (yield* FirstMessageReading).settled
          const listed = yield* client["session.list"]({ projectPath: "/p" })
          kept.push(listed.find(({ id }) => id === session.id)!.title)
        }
        return kept
      }),
  )

  expect(titles).toEqual(["By user", "By agent"])
})

test("when the model fails, the session keeps its first-line title, goes on, and the log holds the error", async () => {
  const logPath = join(mkdtempSync(join(tmpdir(), "ivin-log-")), "ivin.log")
  const run = await withServer(
    () => Effect.fail(new HarnessError({ message: "Not logged in" })),
    (client) =>
      Effect.gen(function* () {
        const first = yield* firstMessage(client, "fix the drag")
        const next = yield* client["session.sendMessage"]({
          sessionId: first.sessionId,
          messageId: crypto.randomUUID(),
          text: "and the drop",
        })
        return { title: first.title, next: next.title }
      }),
    logPath,
  )

  expect(run).toEqual({ title: "fix the drag", next: "fix the drag" })
  expect(readFileSync(logPath, "utf8")).toContain("Not logged in")
})

test("a session the user named before its first message keeps its name and still gets the citation", async () => {
  const run = await withServer(
    reply({ title: "Generated", workItem: { kind: "issue", number: 127 } }),
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* client["session.rename"]({ sessionId: session.id, title: "Mine" })
        return yield* sendFirst(client, session.id, "implement #127")
      }),
  )

  expect(run).toEqual({
    title: "Mine",
    citations: [{ ns: "ivin", data: { kind: "issue", number: 127 } }],
  })
})

test("only the first message is read", async () => {
  const prompts: string[] = []
  await withServer(
    (prompt) => {
      prompts.push(prompt)
      return Effect.succeed('{"title": "Drag"}')
    },
    (client) =>
      Effect.gen(function* () {
        const first = yield* firstMessage(client, "fix the drag")
        yield* sendFirst(client, first.sessionId, "now the drop")
      }),
  )

  expect(prompts).toHaveLength(1)
})
