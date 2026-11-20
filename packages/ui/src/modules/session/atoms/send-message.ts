import { Effect } from "effect"
import type { Session, WorkingFolderChoice } from "@ivin/contracts/session"
import type { ImageData, TranscriptItem } from "@ivin/contracts/transcript"
import { optimistic } from "@ivin/state/optimistic"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { transcriptOf } from "../../transcript/atoms/get-items.ts"
import { forgetSentImages, rememberSentImages } from "../../transcript/atoms/sent-images.ts"
import { sessionsOf } from "./list-sessions.ts"

export const sendMessageAtom = serverRuntime.fn<{
  readonly projectPath: string
  readonly sessionId: string
  readonly text: string
  readonly images?: ReadonlyArray<ImageData>
  readonly workingFolder?: WorkingFolderChoice
}>()(
  Effect.fnUntraced(function* ({ projectPath, sessionId, text, images = [], workingFolder }, get) {
    const client = yield* ServerClient
    const transcript = transcriptOf(sessionId)
    const messageId = crypto.randomUUID()
    const lastId = get.registry.get(transcript.list.ids).at(-1)
    const last = lastId === undefined ? undefined : yield* transcript.list.get(lastId)

    const pending: TranscriptItem = {
      id: messageId,
      sessionId,
      position: (last?.position ?? -1) + 1,
      at: Date.now(),
      type: "message",
      role: "user",
      text,
      images: images.map(({ id, number, mediaType }) => ({ id, number, mediaType })),
    }
    rememberSentImages(images)

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
        ...(images.length > 0 && { images }),
        ...(workingFolder && { workingFolder }),
      }),
    ).pipe(Effect.ensuring(Effect.sync(() => forgetSentImages(images))))
  }),
  // A second message sent before the first is answered would otherwise cancel the first.
  { concurrent: true },
)
