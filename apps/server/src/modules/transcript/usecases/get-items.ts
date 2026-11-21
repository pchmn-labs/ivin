import { HarnessProvider } from "@ivin/harness"
import { Effect } from "effect"
import { deriveItems } from "../rules/derive-items.ts"
import { pageAround } from "../rules/page-around.ts"
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
    return pageAround(
      deriveItems(yield* store.events(sessionId), toolKind),
      position,
      before,
      after,
    )
  })
