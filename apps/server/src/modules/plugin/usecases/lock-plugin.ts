import { Effect } from "effect"
import { findPluginFolder } from "./find-plugin-folder.ts"

export const lockPlugin = (id: string) =>
  Effect.gen(function* () {
    const { plugins, folder } = yield* findPluginFolder(id)
    yield* plugins.lock(folder.path)
  })
