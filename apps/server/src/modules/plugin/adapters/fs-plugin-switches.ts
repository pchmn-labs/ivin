import { Effect, Layer } from "effect"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { PluginSwitches } from "../usecases/plugin-switches.ts"

// The desktop app writes this file too when the window freezes: a JSON array of ids.
const readIds = async (file: string): Promise<string[]> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"))
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []
  } catch {
    return []
  }
}

export const layerFsPluginSwitches = (ivinHome: string, safe: boolean) => {
  const file = join(ivinHome, "disabled-plugins.json")
  return Layer.succeed(PluginSwitches)({
    safe,
    disabled: Effect.promise(async () => new Set(safe ? [] : await readIds(file))),
    setEnabled: (id, enabled) =>
      Effect.promise(async () => {
        const ids = new Set(await readIds(file))
        if (enabled) ids.delete(id)
        else ids.add(id)
        await mkdir(ivinHome, { recursive: true, mode: 0o700 })
        const partial = `${file}.${process.pid}.partial`
        await writeFile(partial, JSON.stringify([...ids].sort()))
        await rename(partial, file)
      }),
  })
}
