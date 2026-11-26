import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { bundle, hashOf, type Half } from "../src/modules/plugin/adapters/plugin-bundler.ts"
import { readManifest } from "../src/modules/plugin/rules/manifest.ts"

const pluginsFolder = resolve(import.meta.dirname, "../../../plugins")
const outFolder = resolve(import.meta.dirname, "../dist/builtin-plugins")

// The same bundles a user plugin gets at launch, built once so the packaged app compiles nothing.
const compile = async (folder: string, entry: string, half: Half) => {
  const name = `${await hashOf(folder, entry, half)}${half === "ui" ? ".js" : ".mjs"}`
  for (const { fileName, code } of await bundle(folder, join(folder, entry), null, name, half)) {
    const target = join(outFolder, fileName)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, code)
  }
  return name
}

await rm(outFolder, { recursive: true, force: true })
await mkdir(outFolder, { recursive: true })
const index: Array<{ id: string; manifest: string; ui: string | null; server: string | null }> = []
for (const name of (await readdir(pluginsFolder)).sort()) {
  const folder = join(pluginsFolder, name)
  const manifest = await readFile(join(folder, "package.json"), "utf8").catch(() => null)
  if (manifest === null) continue
  const reading = readManifest(manifest)
  if (reading.kind === "invalid") throw new Error(`The built-in plugin ${name}: ${reading.reason}`)
  const { id, ui, server } = reading.manifest
  index.push({
    id,
    manifest,
    ui: ui === null ? null : await compile(folder, ui, "ui"),
    server: server === null ? null : await compile(folder, server, "server"),
  })
}
await writeFile(join(outFolder, "index.json"), JSON.stringify(index))
