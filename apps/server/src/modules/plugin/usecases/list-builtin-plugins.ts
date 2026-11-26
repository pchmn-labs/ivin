import type { UserPlugin } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { BuiltinPlugins } from "./builtin-plugins.ts"
import { disabledPlugins } from "./plugin-switches.ts"
import { UiHalfPermissions } from "./ui-half-permissions.ts"

export const listBuiltinPlugins = Effect.gen(function* () {
  const builtins = yield* BuiltinPlugins
  const disabled = yield* disabledPlugins
  const known = yield* UiHalfPermissions
  return (builtins?.plugins ?? []).flatMap((builtin): UserPlugin[] => {
    const reading = readManifest(builtin.manifest)
    if (reading.kind === "invalid" || builtin.ui === null) return []
    const { id, name, views, permissions } = reading.manifest
    if (disabled.has(id)) return []
    known.set(id, "builtin", permissions)
    return [{ _tag: "compiled", id, name, bundle: builtin.ui, views }]
  })
})
