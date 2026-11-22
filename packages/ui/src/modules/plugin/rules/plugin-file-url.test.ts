import { expect, test } from "vitest"
import { pluginFileUrl } from "./plugin-file-url.ts"

test("a plugin's file URL names the plugin, then the file's path in its folder", () => {
  expect(pluginFileUrl("file-icons", "icons/nodejs.svg")).toBe(
    "ivin-plugin://file-icons/icons/nodejs.svg",
  )
})

test("each segment of the path is encoded", () => {
  expect(pluginFileUrl("p", "a b/c#d.svg")).toBe("ivin-plugin://p/a%20b/c%23d.svg")
})
