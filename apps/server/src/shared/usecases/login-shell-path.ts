import { HarnessProvider } from "@ivin/harness"
import { Context, Effect, Layer } from "effect"

export interface LoginShellPathService {
  // Folders of the login shell's PATH, null when unreadable; never ends while the read runs.
  readonly ready: Effect.Effect<ReadonlyArray<string> | null>
}

// The default is a read already over, so a test or a server without a login shell never waits.
export const LoginShellPath = Context.Reference<LoginShellPathService>(
  "ivin/server/LoginShellPath",
  { defaultValue: () => ({ ready: Effect.succeed(null) }) },
)

// Agents inherit the server's PATH when they start, so each way into one waits for the read.
export const layerHarnessAfterLoginShellPath = <E, R>(
  harness: Layer.Layer<HarnessProvider, E, R>,
) =>
  Layer.effect(HarnessProvider)(
    Effect.gen(function* () {
      const inner = yield* HarnessProvider
      const { ready } = yield* LoginShellPath
      const { completeText } = inner
      return {
        ...inner,
        // The Claude provider keeps its first answer, fallback included.
        runOptions: Effect.andThen(ready, inner.runOptions),
        program: Effect.andThen(ready, inner.program),
        completeText:
          completeText === null
            ? null
            : (prompt: string) => Effect.andThen(ready, completeText(prompt)),
        start: (input) => Effect.andThen(ready, inner.start(input)),
      }
    }),
  ).pipe(Layer.provide(harness))
