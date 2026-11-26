import { Effect, Layer } from "effect"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { BuiltinPlugins, type BuiltinPlugin } from "../usecases/builtin-plugins.ts"

// `folder` is what the server's build wrote: the bundles and their `index.json`.
export const layerFsBuiltinPlugins = (folder: string) =>
  Layer.effect(BuiltinPlugins)(
    Effect.promise(async () => {
      const plugins = JSON.parse(
        await readFile(join(folder, "index.json"), "utf8"),
      ) as BuiltinPlugin[]
      return { plugins, bundlePath: (name: string) => join(folder, name) }
    }),
  )
