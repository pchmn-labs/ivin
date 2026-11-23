import { HarnessProvider } from "@ivin/harness"
import { Effect } from "effect"
import { ITEMS_VERSION, replay } from "../rules/derive-items.ts"
import { TranscriptStore } from "./transcript-store.ts"

export const ensureItems = (sessionId: string) =>
  Effect.gen(function* () {
    const store = yield* TranscriptStore
    const { toolKind } = yield* HarnessProvider
    yield* store.ensureItems(sessionId, ITEMS_VERSION, (events) => {
      const { items, state } = replay(events, toolKind)
      return { items, openMessageId: state.openMessage?.id ?? null }
    })
  })
