import { Effect } from "effect"
import type { Session, PendingMessage, WorkingFolderChoice } from "@ivin/contracts/session"
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
    const sessions = sessionsOf(projectPath)
    const transcript = transcriptOf(sessionId)
    const messageId = crypto.randomUUID()
    const unsent: PendingMessage = {
      id: messageId,
      text,
      images: images.map(({ id, number, mediaType }) => ({ id, number, mediaType })),
    }
    const session = yield* sessions.get(sessionId)
    const working = session?.status === "working" || session?.status === "waiting"

    const changePending = (
      change: (pending: Session["pendingMessages"]) => Session["pendingMessages"],
    ) =>
      Effect.gen(function* () {
        const current = yield* sessions.get(sessionId)
        if (current) {
          yield* sessions.upsert([{ ...current, pendingMessages: change(current.pendingMessages) }])
        }
      })

    const lastId = get.registry.get(transcript.list.ids).at(-1)
    const last = lastId === undefined ? undefined : yield* transcript.list.get(lastId)
    const shown: TranscriptItem = {
      ...unsent,
      sessionId,
      position: (last?.position ?? -1) + 1,
      at: Date.now(),
      type: "message",
      role: "user",
      steer: false,
    }
    const removeShown = Effect.gen(function* () {
      if ((yield* transcript.list.get(messageId)) === shown) {
        yield* transcript.list.remove(messageId)
      }
    })
    rememberSentImages(images)

    const update = working
      ? {
          apply: changePending((pending) => [...pending, unsent]),
          rollback: changePending((pending) => pending.filter((m) => m.id !== messageId)),
          reconcile: (answer: Session) => sessions.upsert([answer]),
        }
      : {
          apply: transcript.list.upsert([shown]),
          // The server may have stored the message already, and its item then replaced the shown one.
          rollback: removeShown,
          reconcile: (answer: Session) =>
            sessions
              .upsert([answer])
              .pipe(
                Effect.andThen(
                  answer.pendingMessages.some((m) => m.id === messageId)
                    ? removeShown
                    : Effect.void,
                ),
              ),
        }

    return yield* optimistic<Session>(update)(
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
