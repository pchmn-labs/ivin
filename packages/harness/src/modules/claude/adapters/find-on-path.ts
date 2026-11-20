import { accessSync, constants, statSync } from "node:fs"
import { delimiter, join } from "node:path"

// The file `spawn(name)` would run, or null.
export const findOnPath = (name: string): string | null => {
  for (const folder of (process.env["PATH"] ?? "").split(delimiter)) {
    if (folder === "") continue
    const candidate = join(folder, name)
    try {
      accessSync(candidate, constants.X_OK)
      if (statSync(candidate).isFile()) return candidate
    } catch {
      continue
    }
  }
  return null
}
