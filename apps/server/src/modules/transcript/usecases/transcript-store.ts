import type { TranscriptEvent } from "@ivin/contracts/transcript"
import { Context, type Effect } from "effect"

export class TranscriptStore extends Context.Service<
  TranscriptStore,
  {
    readonly append: (event: TranscriptEvent) => Effect.Effect<void>
    readonly lastSequence: (sessionId: string) => Effect.Effect<number>
    readonly events: (sessionId: string) => Effect.Effect<readonly TranscriptEvent[]>
  }
>()("ivin/server/TranscriptStore") {}
