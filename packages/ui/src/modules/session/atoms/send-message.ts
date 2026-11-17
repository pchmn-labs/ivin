import { Effect } from "effect"
import type { Session } from "@ivin/contracts/session"
import { optimistic } from "@ivin/state/optimistic"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { transcriptOf } from "../../transcript/atoms/get-items.ts"
import { sessionsOf } from "./list-sessions.ts"

export const sendMessageAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
  readonly text: string
}>()(
  Effect.fnUntraced(function* ({ projectPath, sessionId, text }, get) {
    const client = yield* ServerClient
    const transcript = transcriptOf(sessionId)
    const messageId = crypto.randomUUID()
    const lastId = get.registry.get(transcript.list.ids).at(-1)
    const last = lastId === undefined ? undefined : yield* transcript.list.get(lastId)

    return yield* optimistic<Session>({
      apply: transcript.list.upsert([
        {
          id: messageId,
          sessionId,
          position: (last?.position ?? -1) + 1,
          type: "message",
          role: "user",
          text,
        },
      ]),
      rollback: transcript.list.remove(messageId),
      reconcile: (session) => sessionsOf(projectPath).upsert([session]),
    })(client["session.sendMessage"]({ sessionId, messageId, text }))
  }),
)
