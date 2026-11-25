import type { PluginSettingDeclaration } from "@ivin/contracts/setting"
import { Context, Effect } from "effect"

// Read when a window subscribes and when a setting is read or written, so a plugin added later shows.
export const PluginSettingDeclarations = Context.Reference<
  Effect.Effect<ReadonlyArray<PluginSettingDeclaration>>
>("ivin/server/PluginSettingDeclarations", {
  defaultValue: () => Effect.succeed([]),
})
