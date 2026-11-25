import { readdirSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "vitest"
import { builtinPackages } from "../modules/plugin/rules/builtin-packages.ts"
import { readManifest } from "../modules/plugin/rules/manifest.ts"

const pluginsFolder = join(import.meta.dirname, "../../../../plugins")

test("every built-in plugin's package.json is listed and holds a valid manifest", () => {
  const ids = builtinPackages.map((text) => {
    const reading = readManifest(text)
    expect(reading.kind).toBe("valid")
    return reading.kind === "valid" ? reading.manifest.id : ""
  })
  const folders = readdirSync(pluginsFolder, { withFileTypes: true }).filter((e) => e.isDirectory())
  expect(ids.toSorted()).toEqual(folders.map((folder) => folder.name).toSorted())
})
