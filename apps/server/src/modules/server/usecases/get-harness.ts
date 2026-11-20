import { HarnessProvider } from "@ivin/harness"
import { Effect } from "effect"

export const getHarness = Effect.gen(function* () {
  const { id, runOptions } = yield* HarnessProvider
  return { id, runOptions }
})
