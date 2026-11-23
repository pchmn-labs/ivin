import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Rpcs } from "@ivin/contracts/rpcs"
import type { Session } from "@ivin/contracts/session"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import {
  layerScripted,
  type RequestAnswer,
  type ScriptedElement,
  type ScriptedOptions,
} from "@ivin/harness"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { trustEveryFolder } from "./trust-every-folder.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { handlers, layerServices } from "./handlers.ts"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"

const said = (text: string): HarnessOutput => ({ type: "assistant_text", text, raw: null })
const running: HarnessOutput = { type: "status", status: "running", raw: null }
const idle: HarnessOutput = { type: "status", status: "idle", raw: null }
const questions = [
  {
    question: "Which colour?",
    header: "Colour",
    options: [
      { label: "Red", description: "Warm." },
      { label: "Blue", description: "Cool." },
    ],
    multiSelect: false,
  },
  {
    question: "Which fruits?",
    header: "Fruits",
    options: [
      { label: "Apple", description: "Crisp." },
      { label: "Plum", description: "Small." },
    ],
    multiSelect: true,
  },
]
const asked: HarnessOutput = {
  type: "question_request",
  requestId: "q1",
  toolCallId: "t1",
  questions,
  raw: null,
}
const approval: HarnessOutput = {
  type: "approval_request",
  requestId: "r1",
  toolCallId: "t2",
  name: "ls",
  input: { path: "." },
  raw: null,
}

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const newDatabase = () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  trustEveryFolder(db)
  return db
}

const withServer = <A, E>(
  db: DatabaseSync,
  turns: readonly (readonly ScriptedElement[])[],
  use: (client: Client) => Effect.Effect<A, E>,
  options: ScriptedOptions = {},
) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provide(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(
            Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
          ),
          Layer.provide(layerScripted(turns, { reportSession: true, ...options })),
        ),
      ),
      Effect.scoped,
    ),
  )

const until = <A, E>(read: Effect.Effect<A, E>, done: (value: A) => boolean) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 200; attempt++) {
      const value = yield* read
      if (done(value)) return value
      yield* Effect.sleep("5 millis")
    }
    return yield* Effect.die("The condition was never met")
  })

const sessionOf = (client: Client, id: string) =>
  client["session.list"]({ projectPath: "/p" }).pipe(
    Effect.map((sessions) => sessions.find((s) => s.id === id)!),
  )

const untilSession = (client: Client, id: string, done: (session: Session) => boolean) =>
  until(sessionOf(client, id), done)

const items = (client: Client, sessionId: string) =>
  client["transcript.getItems"]({ sessionId, position: null, before: 100, after: 100 }).pipe(
    Effect.map((page) => page.items),
  )

const questionItem = (client: Client, sessionId: string) =>
  items(client, sessionId).pipe(Effect.map((all) => all.find((item) => item.type === "question")))

const askQuestions = (client: Client) =>
  Effect.gen(function* () {
    const session = yield* client["session.create"]({ projectPath: "/p" })
    yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
    yield* untilSession(client, session.id, (s) => s.status === "waiting")
    return session.id
  })

const answers = [
  { question: "Which colour?", choices: ["Green, like grass"] },
  { question: "Which fruits?", choices: ["Apple", "Plum"] },
]

test("answering the agent's questions stores the answers, sends them to the agent and lets the turn finish", async () => {
  const responded: RequestAnswer[] = []
  const db = newDatabase()
  const outcome = await withServer(
    db,
    [[running, asked, said("Green it is."), idle]],
    (client) =>
      Effect.gen(function* () {
        const id = yield* askQuestions(client)
        const open = yield* questionItem(client, id)
        yield* client["session.answerQuestion"]({ sessionId: id, requestId: "q1", answers })
        const after = yield* untilSession(client, id, (s) => s.status === "idle")
        return { open, after, answered: yield* questionItem(client, id) }
      }),
    { responded },
  )
  const stored = db
    .prepare("SELECT payload FROM transcript_events WHERE type = 'question_answer'")
    .all() as { payload: string }[]

  expect(outcome.open).toMatchObject({ requestId: "q1", questions, status: "open", answers: [] })
  expect(responded).toEqual([{ requestId: "q1", answers }])
  expect(stored.map((row) => JSON.parse(row.payload))).toMatchObject([{ requestId: "q1", answers }])
  expect(outcome.answered).toMatchObject({ status: "answered", answers })
  expect(outcome.after.status).toBe("idle")
})

test("declining the agent's questions tells the agent and keeps the questions as declined", async () => {
  const responded: RequestAnswer[] = []
  const declined = await withServer(
    newDatabase(),
    [[running, asked, said("Fine."), idle]],
    (client) =>
      Effect.gen(function* () {
        const id = yield* askQuestions(client)
        yield* client["session.answerQuestion"]({ sessionId: id, requestId: "q1", answers: null })
        yield* untilSession(client, id, (s) => s.status === "idle")
        return yield* questionItem(client, id)
      }),
    { responded },
  )

  expect(responded).toEqual([{ requestId: "q1", answers: null }])
  expect(declined).toMatchObject({ status: "declined", answers: [] })
})

test("answering questions that are not open fails, and so does answering an approval as questions", async () => {
  const errors = await withServer(
    newDatabase(),
    [[running, approval, said("Done."), idle]],
    (client) =>
      Effect.gen(function* () {
        const id = yield* askQuestions(client)
        const tagOf = (requestId: string) =>
          client["session.answerQuestion"]({ sessionId: id, requestId, answers }).pipe(
            Effect.flip,
            Effect.map((error) => error._tag),
          )
        return [yield* tagOf("r1"), yield* tagOf("zz")]
      }),
  )

  expect(errors).toEqual(["QuestionNotOpen", "QuestionNotOpen"])
})

test("an approval cannot be answered through a question's request id", async () => {
  const error = await withServer(newDatabase(), [[running, asked, said("Done."), idle]], (client) =>
    Effect.gen(function* () {
      const id = yield* askQuestions(client)
      return yield* client["session.answerApproval"]({
        sessionId: id,
        requestId: "q1",
        allow: true,
      }).pipe(Effect.flip)
    }),
  )

  expect(error._tag).toBe("ApprovalNotOpen")
})

test("after a server restart the questions are not answered, the session is idle, and answering them says they are no longer waited on", async () => {
  const db = newDatabase()
  const sessionId = await withServer(db, [[running, asked]], (client) => askQuestions(client))

  const after = await withServer(db, [[running, asked]], (client) =>
    Effect.gen(function* () {
      const session = yield* sessionOf(client, sessionId)
      const item = yield* questionItem(client, sessionId)
      const error = yield* client["session.answerQuestion"]({
        sessionId,
        requestId: "q1",
        answers,
      }).pipe(Effect.flip)
      return { status: session.status, item, error: error._tag }
    }),
  )

  expect(after).toMatchObject({
    status: "idle",
    item: { status: "unanswered" },
    error: "QuestionNotOpen",
  })
})

test("a waiting session says whether it waits on questions or on an approval, and no longer once answered", async () => {
  const seen = await withServer(
    newDatabase(),
    [[running, asked, said("Thanks."), approval, said("Done."), idle]],
    (client) =>
      Effect.gen(function* () {
        const id = yield* askQuestions(client)
        const onQuestions = (yield* sessionOf(client, id)).waitingFor
        yield* client["session.answerQuestion"]({ sessionId: id, requestId: "q1", answers })
        const onApproval = (yield* untilSession(client, id, (s) => s.waitingFor === "approval"))
          .waitingFor
        yield* client["session.answerApproval"]({ sessionId: id, requestId: "r1", allow: true })
        const done = yield* untilSession(client, id, (s) => s.status === "idle")
        return [onQuestions, onApproval, done.waitingFor]
      }),
  )

  expect(seen).toEqual(["question", "approval", null])
})
