import { AgentCommandsNotListed, SessionNotFound } from "@ivin/contracts/session"
import { HarnessProvider } from "@ivin/harness"
import { Effect } from "effect"
import { logError } from "../../log/usecases/log-error.ts"
import { sessionFolderTrusted } from "./session-trust.ts"
import { SessionStore } from "./session-store.ts"

export const listAgentCommands = (sessionId: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (!session) return yield* new SessionNotFound({ sessionId })
    const { id, listCommands } = yield* HarnessProvider
    // A session kept from another harness has nothing this server can list.
    if (listCommands === null || session.harness !== id) return null
    if (!(yield* sessionFolderTrusted(session)))
      return yield* new AgentCommandsNotListed({ sessionId })
    return yield* listCommands(session.workingFolder).pipe(
      Effect.tapError((error) => logError("session.listAgentCommands", error)),
      Effect.mapError(() => new AgentCommandsNotListed({ sessionId })),
    )
  })
