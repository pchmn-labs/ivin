import { HarnessProvider } from "@ivin/harness"
import { Effect } from "effect"

export const getHarness = Effect.gen(function* () {
  const { id } = yield* HarnessProvider
  return id
})
