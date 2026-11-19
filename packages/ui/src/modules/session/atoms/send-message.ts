import { Effect } from "effect"
import type { Session, WorkingFolderChoice } from "@ivin/contracts/session"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { optimistic } from "@ivin/state/optimistic"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { transcriptOf } from "../../transcript/atoms/get-items.ts"
import { sessionsOf } from "./list-sessions.ts"

export const sendMessageAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
  readonly text: string
  readonly workingFolder?: WorkingFolderChoice
}>()(
  Effect.fnUntraced(function* ({ projectPath, sessionId, text, workingFolder }, get) {
    const client = yield* ServerClient
    const transcript = transcriptOf(sessionId)
    const messageId = crypto.randomUUID()
    const lastId = get.registry.get(transcript.list.ids).at(-1)
    const last = lastId === undefined ? undefined : yield* transcript.list.get(lastId)

    const pending: TranscriptItem = {
      id: messageId,
      sessionId,
      position: (last?.position ?? -1) + 1,
      type: "message",
      role: "user",
      text,
    }

    return yield* optimistic<Session>({
      apply: transcript.list.upsert([pending]),
      // The server may have stored the message already, and its item then replaced the pending one.
      rollback: Effect.gen(function* () {
        if ((yield* transcript.list.get(messageId)) === pending) {
          yield* transcript.list.remove(messageId)
        }
      }),
      reconcile: (session) => sessionsOf(projectPath).upsert([session]),
    })(
      client["session.sendMessage"]({
        sessionId,
        messageId,
        text,
        ...(workingFolder && { workingFolder }),
      }),
    )
  }),
  // A second message sent before the first is answered would otherwise cancel the first.
  { concurrent: true },
)
