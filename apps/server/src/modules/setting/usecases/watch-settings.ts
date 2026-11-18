import { Effect, Stream } from "effect"
import { CurrentSettings } from "./current-settings.ts"

export const watchSettings = Stream.unwrap(
  Effect.gen(function* () {
    return (yield* CurrentSettings).changes
  }),
)
