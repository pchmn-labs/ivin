import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { titleFromMessage } from "../rules/session-title.ts"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

export const sendMessage = (sessionId: string, messageId: string, text: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const runs = yield* SessionRuns
    const session = yield* store.findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    const title = titleFromMessage(text)
    if (title !== "") yield* store.setTitleIfUnset(sessionId, title)
    // A harness failure is a defect here: the contract has no error for it yet.
    yield* runs.send(session, { id: messageId, text }).pipe(Effect.orDie)
    return (yield* store.findById(sessionId)) ?? session
  })
