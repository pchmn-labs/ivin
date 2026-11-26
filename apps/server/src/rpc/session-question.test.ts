import type { HarnessOutput } from "@ivin/contracts/transcript"
import type { RequestAnswer, ScriptedElement, ScriptedOptions } from "@ivin/harness"
import { Effect } from "effect"
import type { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { idle, running, said, itemsOf as items, sessionOf, untilSession } from "./test-scripts.ts"
import { newDatabase, withServer as withTestServer, type Client } from "./test-server.ts"

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

const withServer = <A, E>(
  db: DatabaseSync,
  turns: readonly (readonly ScriptedElement[])[],
  use: (client: Client) => Effect.Effect<A, E>,
  options: ScriptedOptions = {},
) => withTestServer(use, { db, turns, scripted: { reportSession: true, ...options } })

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
