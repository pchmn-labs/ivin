import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, expect, test } from "vitest"
import { pluginFile } from "./plugin-protocol.ts"

let root: string
let plugins: string

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "ivin-plugin-protocol-")))
  plugins = join(root, "plugins")
  await mkdir(join(plugins, "file-icons", "icons"), { recursive: true })
  await mkdir(join(plugins, "other"), { recursive: true })
  await writeFile(join(plugins, "file-icons", "icons", "nodejs.svg"), "<svg/>")
  await writeFile(join(plugins, "file-icons", "a b.svg"), "<svg/>")
  await writeFile(join(plugins, "other", "secret.svg"), "<svg/>")
  await writeFile(join(root, "outside.txt"), "secret")
})
afterEach(() => rm(root, { recursive: true, force: true }))

test("a plugin's file is served from its folder", async () => {
  expect(await pluginFile(plugins, "ivin-plugin://file-icons/icons/nodejs.svg")).toBe(
    join(plugins, "file-icons", "icons", "nodejs.svg"),
  )
  expect(await pluginFile(plugins, "ivin-plugin://file-icons/a%20b.svg")).toBe(
    join(plugins, "file-icons", "a b.svg"),
  )
})

test("a path with .. leading out of the plugin's folder is refused", async () => {
  expect(await pluginFile(plugins, "ivin-plugin://file-icons/..%2Fother%2Fsecret.svg")).toBeNull()
  expect(await pluginFile(plugins, "ivin-plugin://file-icons/%2E%2E/other/secret.svg")).toBeNull()
  expect(
    await pluginFile(plugins, "ivin-plugin://file-icons/icons/../../other/secret.svg"),
  ).toBeNull()
  expect(await pluginFile(plugins, "ivin-plugin://../outside.txt")).toBeNull()
})

test("a symlink leading out of the plugin's folder is refused", async () => {
  await symlink(join(root, "outside.txt"), join(plugins, "file-icons", "link.txt"))
  await symlink(root, join(plugins, "file-icons", "up"))
  expect(await pluginFile(plugins, "ivin-plugin://file-icons/link.txt")).toBeNull()
  expect(await pluginFile(plugins, "ivin-plugin://file-icons/up/outside.txt")).toBeNull()
})

test("a missing file, or a URL that is not a plugin's, gives nothing", async () => {
  expect(await pluginFile(plugins, "ivin-plugin://file-icons/icons/none.svg")).toBeNull()
  expect(await pluginFile(plugins, "ivin-plugin://file-icons/%E0%A4%A")).toBeNull()
  expect(await pluginFile(plugins, "not a url")).toBeNull()
})
