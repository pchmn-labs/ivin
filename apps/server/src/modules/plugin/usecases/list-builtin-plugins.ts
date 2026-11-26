import type { UserPlugin } from "@ivin/contracts/plugin"
import { Effect } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { BuiltinPlugins } from "./builtin-plugins.ts"

export const listBuiltinPlugins = Effect.gen(function* () {
  const builtins = yield* BuiltinPlugins
  return (builtins?.plugins ?? []).flatMap((builtin): UserPlugin[] => {
    const reading = readManifest(builtin.manifest)
    if (reading.kind === "invalid" || builtin.ui === null) return []
    const { id, name, views } = reading.manifest
    return [{ _tag: "compiled", id, name, bundle: builtin.ui, views }]
  })
})
