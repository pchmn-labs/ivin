import type { DatabaseSync } from "node:sqlite"
import type { Session } from "@ivin/contracts/session"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import { Effect } from "effect"
import type { Client } from "./test-server.ts"
import { until } from "./test-waits.ts"

export const said = (text: string): HarnessOutput => ({
  type: "assistant_text",
  text,
  raw: null,
})
export const running: HarnessOutput = { type: "status", status: "running", raw: null }
export const idle: HarnessOutput = { type: "status", status: "idle", raw: null }

export const askedApproval: HarnessOutput = {
  type: "approval_request",
  requestId: "r1",
  toolCallId: "t1",
  name: "ls",
  input: { path: "." },
  raw: null,
}

export const sessionOf = (client: Client, id: string, projectPath = "/p") =>
  client["session.list"]({ projectPath }).pipe(
    Effect.map((sessions) => sessions.find((s) => s.id === id)!),
  )

export const untilSession = (client: Client, id: string, done: (session: Session) => boolean) =>
  until(sessionOf(client, id), done)

export const itemsOf = (client: Client, sessionId: string) =>
  client["transcript.getItems"]({ sessionId, position: null, before: 100, after: 100 }).pipe(
    Effect.map((page) => page.items),
  )

export const typesOf = (db: DatabaseSync, sessionId: string) =>
  (
    db
      .prepare("SELECT type FROM transcript_events WHERE session_id = ? ORDER BY sequence")
      .all(sessionId) as { type: string }[]
  ).map((row) => row.type)

export const untilClosed = (closed: string[], sessionId: string) =>
  until(
    Effect.sync(() => closed),
    (all) => all.includes(sessionId),
  )

export const send = (client: Client, sessionId: string, messageId: string) =>
  client["session.sendMessage"]({ sessionId, messageId, text: "go" })
