import { Context, Effect } from "effect"

export interface PluginSwitchesService {
  // Safe mode: only the built-in plugins load, and `disabled` is empty.
  readonly safe: boolean
  // The ids turned off, read fresh each time.
  readonly disabled: Effect.Effect<ReadonlySet<string>>
  readonly setEnabled: (id: string, enabled: boolean) => Effect.Effect<void>
}

// Null when the server keeps no list of disabled plugins: all are on.
export const PluginSwitches = Context.Reference<PluginSwitchesService | null>(
  "ivin/server/PluginSwitches",
  { defaultValue: () => null },
)

export const disabledPlugins = Effect.gen(function* () {
  const switches = yield* PluginSwitches
  return switches === null ? new Set<string>() : yield* switches.disabled
})
