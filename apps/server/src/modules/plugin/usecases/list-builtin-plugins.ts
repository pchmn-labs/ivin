import type { UserPlugin } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { BuiltinPlugins } from "./builtin-plugins.ts"
import { disabledPlugins } from "./plugin-switches.ts"

export const listBuiltinPlugins = Effect.gen(function* () {
  const builtins = yield* BuiltinPlugins
  const disabled = yield* disabledPlugins
  return (builtins?.plugins ?? []).flatMap((builtin): UserPlugin[] => {
    const reading = readManifest(builtin.manifest)
    if (reading.kind === "invalid" || builtin.ui === null) return []
    const { id, name, views } = reading.manifest
    if (disabled.has(id)) return []
    return [{ _tag: "compiled", id, name, bundle: builtin.ui, views }]
  })
})
