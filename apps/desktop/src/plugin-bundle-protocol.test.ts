import { join } from "node:path"
import { expect, test } from "vitest"
import { pluginBundleFile } from "./plugin-bundle-protocol.ts"

const folder = "/home/.ivin/cache/plugins"
const builtin = "/app/builtin-plugins"
const hash = "a".repeat(64)

test("a bundle URL names its file in the plugin cache", () => {
  expect(pluginBundleFile(folder, builtin, `ivin-plugin-bundle://cache/${hash}.js`)).toBe(
    join(folder, `${hash}.js`),
  )
})

test("a built-in bundle URL names its file in the app's own folder", () => {
  expect(pluginBundleFile(folder, builtin, `ivin-plugin-bundle://builtin/${hash}.js`)).toBe(
    join(builtin, `${hash}.js`),
  )
  expect(
    pluginBundleFile(folder, builtin, `ivin-plugin-bundle://builtin/..%2F${hash}.js`),
  ).toBeNull()
})

test("a chunk URL names its file in the folder of its bundle", () => {
  expect(
    pluginBundleFile(folder, builtin, `ivin-plugin-bundle://cache/${hash}/panel-x1Y_2.js`),
  ).toBe(join(folder, hash, "panel-x1Y_2.js"))
})

test("a URL that could leave the cache, or names no bundle, gives nothing", () => {
  expect(
    pluginBundleFile(folder, builtin, "ivin-plugin-bundle://cache/..%2F..%2Fsettings.json"),
  ).toBeNull()
  expect(
    pluginBundleFile(folder, builtin, "ivin-plugin-bundle://cache/../settings.json"),
  ).toBeNull()
  expect(pluginBundleFile(folder, builtin, `ivin-plugin-bundle://other/${hash}.js`)).toBeNull()
  expect(pluginBundleFile(folder, builtin, `ivin-plugin-bundle://cache/x/${hash}.js`)).toBeNull()
  expect(pluginBundleFile(folder, builtin, `ivin-plugin-bundle://cache/${hash}/../x.js`)).toBeNull()
  expect(
    pluginBundleFile(folder, builtin, `ivin-plugin-bundle://cache/${hash}/%2e%2e/x.js`),
  ).toBeNull()
  expect(
    pluginBundleFile(folder, builtin, `ivin-plugin-bundle://cache/${hash}/..%2Fx.js`),
  ).toBeNull()
  expect(pluginBundleFile(folder, builtin, `ivin-plugin-bundle://cache/${hash}/a/b.js`)).toBeNull()
  expect(
    pluginBundleFile(folder, builtin, `ivin-plugin-bundle://cache/${"b".repeat(63)}/x.js`),
  ).toBeNull()
  expect(pluginBundleFile(folder, builtin, "not a url")).toBeNull()
})
