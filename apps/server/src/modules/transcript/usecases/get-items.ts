import { HarnessProvider } from "@ivin/harness"
import { Effect } from "effect"
import { ensureItems } from "./ensure-items.ts"
import { TranscriptStore } from "./transcript-store.ts"

export const getItems = (
  sessionId: string,
  position: number | null,
  before: number,
  after: number,
) =>
  Effect.gen(function* () {
    const store = yield* TranscriptStore
    const { toolKind } = yield* HarnessProvider
    yield* ensureItems(sessionId)
    const page = yield* store.itemsPage(sessionId, position, before, after)
    // The harness's tool table may have changed since the item was stored.
    return {
      ...page,
      items: page.items.map((item) =>
        item.type === "tool_call" ? { ...item, kind: toolKind(item.name) } : item,
      ),
    }
  })
