import { strongFamily } from "@ivin/state/strong-family"
import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import type { PendingMessage } from "@ivin/contracts/session"
import type { DraftImage } from "@ivin/plugin-api/ui"
import { storedImageUrl } from "../../transcript/rules/image-url.ts"
import { bytesToBase64, withUnreadMessages, type UnreadMessage } from "../rules/draft.ts"
import { draftOf } from "./draft.ts"

// Ids of the unread messages already put in the draft, kept because the composer remounts on each tab switch.
const takenUnreadOf = strongFamily((_sessionId: string) =>
  Atom.make<ReadonlyArray<string>>([]).pipe(Atom.keepAlive),
)

const readImage = (sessionId: string, image: PendingMessage["images"][number]) =>
  Effect.tryPromise(async (signal): Promise<DraftImage> => {
    const response = await fetch(storedImageUrl(sessionId, image), { signal })
    if (!response.ok) throw new Error(`image ${image.id}: ${response.status}`)
    return {
      id: crypto.randomUUID(),
      number: image.number,
      mediaType: image.mediaType,
      base64: bytesToBase64(new Uint8Array(await response.arrayBuffer())),
      name: "Image",
    }
  }).pipe(Effect.orElseSucceed(() => null))

export const takeUnreadMessagesAtom = Atom.fn<{
  readonly sessionId: string
  readonly lastImageNumber: number
  readonly messages: ReadonlyArray<PendingMessage>
}>()(
  Effect.fnUntraced(function* ({ sessionId, lastImageNumber, messages }) {
    const taken = takenUnreadOf(sessionId)
    // The server clears unread messages with the next send; later ones are new.
    if (messages.length === 0) return yield* Atom.set(taken, [])
    const already = yield* Atom.get(taken)
    const fresh = messages.filter((message) => !already.includes(message.id))
    if (fresh.length === 0) return
    // Marked before the images are read, so a second call meanwhile adds nothing.
    yield* Atom.set(taken, [...already, ...fresh.map((message) => message.id)])
    const read: ReadonlyArray<UnreadMessage> = yield* Effect.forEach(fresh, (message) =>
      Effect.forEach(
        message.images,
        (image) =>
          readImage(sessionId, image).pipe(
            Effect.map((read) => ({ number: image.number, image: read })),
          ),
        { concurrency: 4 },
      ).pipe(Effect.map((images) => ({ text: message.text, images }))),
    )
    yield* Atom.update(draftOf(sessionId), (draft) =>
      withUnreadMessages(draft, lastImageNumber, read),
    )
  }),
  { concurrent: true },
).pipe(Atom.keepAlive)
