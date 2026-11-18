import type { UserKeybindings } from "@ivin/contracts/keybinding"
import { Effect, Stream } from "effect"
import { readKeybindingsFile } from "../rules/read-keybindings-file.ts"
import { KeybindingsFile } from "./keybindings-file.ts"

const none: UserKeybindings = { keybindings: [], problem: null }

export const watchKeybindings = Stream.unwrap(
  Effect.gen(function* () {
    const file = yield* KeybindingsFile
    return file.contents.pipe(
      Stream.mapAccum(
        () => none,
        (previous, text) => {
          const next = readKeybindingsFile(previous, text)
          return [next, [next]] as const
        },
      ),
      Stream.tap(({ problem }) =>
        problem === null
          ? Effect.void
          : Effect.logWarning("keybindings.json is invalid, keeping the last valid one", problem),
      ),
    )
  }),
)
