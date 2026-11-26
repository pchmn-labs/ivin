import { Context } from "effect"

export interface BuiltinPlugin {
  readonly id: string
  // The text of its package.json.
  readonly manifest: string
  // The prebuilt halves' file names in the built-in folder; null for a half the plugin lacks.
  readonly ui: string | null
  readonly server: string | null
}

export interface BuiltinPluginsService {
  readonly plugins: ReadonlyArray<BuiltinPlugin>
  readonly bundlePath: (name: string) => string
}

// Null when the server runs without the app's prebuilt plugins: none loads.
export const BuiltinPlugins = Context.Reference<BuiltinPluginsService | null>(
  "ivin/server/BuiltinPlugins",
  { defaultValue: () => null },
)
