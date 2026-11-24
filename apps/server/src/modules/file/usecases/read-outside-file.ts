import { FileNotRead } from "@ivin/contracts/file"
import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { readContent } from "./read-content.ts"

export const readOutsideFile = (sessionId: string, path: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    if (!path.startsWith("/")) return yield* new FileNotRead({ sessionId, path, reason: "missing" })
    return yield* readContent(sessionId, path, path)
  })
