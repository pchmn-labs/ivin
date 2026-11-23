import type { TranscriptEvent, TranscriptItem, TranscriptPage } from "@ivin/contracts/transcript"
import { Context, type Effect } from "effect"
import type { ItemState } from "../rules/derive-items.ts"

type UserMessageEvent = Extract<TranscriptEvent, { type: "user_message" }>

export interface DerivedItems {
  readonly items: readonly TranscriptItem[]
  readonly openMessageId: string | null
}

export class TranscriptStore extends Context.Service<
  TranscriptStore,
  {
    // Stores the event and the item it creates or changes in one transaction.
    readonly append: (
      event: TranscriptEvent,
      change: { readonly item: TranscriptItem | null; readonly openMessageId: string | null },
    ) => Effect.Effect<void>
    readonly lastSequence: (sessionId: string) => Effect.Effect<number>
    readonly events: (sessionId: string) => Effect.Effect<readonly TranscriptEvent[]>
    readonly userMessages: (sessionId: string) => Effect.Effect<readonly UserMessageEvent[]>
    // Replaces the session's items with `derive`'s unless they were derived at `version`.
    readonly ensureItems: (
      sessionId: string,
      version: number,
      derive: (events: readonly TranscriptEvent[]) => DerivedItems,
    ) => Effect.Effect<void>
    // `position: null` anchors the page at the end of the transcript.
    readonly itemsPage: (
      sessionId: string,
      position: number | null,
      before: number,
      after: number,
    ) => Effect.Effect<TranscriptPage>
    // The open items a writer continues from: its message, running tool calls and open requests.
    readonly itemState: (sessionId: string) => Effect.Effect<ItemState>
  }
>()("ivin/server/TranscriptStore") {}
