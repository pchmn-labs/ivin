import { expect, test } from "vitest"
import { readManifest } from "./manifest.ts"

const manifest = (ivin: unknown) => JSON.stringify({ name: "x", ivin })

test("a manifest with an id and a UI entry is valid, and its name defaults to its id", () => {
  expect(readManifest(manifest({ id: "hello-world", ui: "src/ui.tsx" }))).toEqual({
    kind: "valid",
    manifest: {
      id: "hello-world",
      name: "hello-world",
      ui: "src/ui.tsx",
      server: null,
      permissions: { harness: [], exec: [], fetch: [] },
      settings: [],
      views: [],
    },
  })
})

test.each([
  [null, "no package.json"],
  ["{", "not valid JSON"],
  [JSON.stringify({ name: "x" }), "no ivin key"],
  [manifest({ id: "Hello", ui: "src/ui.tsx" }), "ivin.id"],
  [manifest({ id: "../x", ui: "src/ui.tsx" }), "ivin.id"],
  [manifest({ id: "x", name: 3, ui: "src/ui.tsx" }), "ivin.name"],
  [
    manifest({ id: "x", ui: "src/ui.tsx", permissions: { harness: ["*"] } }),
    "ivin.permissions.harness",
  ],
  [manifest({ id: "x" }), "ivin.ui or ivin.server"],
  [manifest({ id: "x", server: 3 }), "ivin.server"],
  [manifest({ id: "x", ui: "" }), "ivin.ui"],
])("%s is invalid, saying %s", (text, reason) => {
  const reading = readManifest(text)
  expect(reading.kind).toBe("invalid")
  expect(reading.kind === "invalid" && reading.reason).toContain(reason)
})

test("a manifest carries its declared permissions", () => {
  const permissions = { harness: ["beforeSpawn"], exec: ["gh"], fetch: ["*.github.com"] }
  const reading = readManifest(manifest({ id: "x", ui: "src/ui.tsx", permissions }))
  expect(reading.kind === "valid" && reading.manifest.permissions).toEqual(permissions)
})

test("a manifest carries its declared settings, and a malformed one is invalid", () => {
  const setting = { type: "number", default: 2, title: "Fold after", description: "Rows." }
  const valid = readManifest(manifest({ id: "x", ui: "src/ui.tsx", settings: { fold: setting } }))
  expect(valid.kind === "valid" && valid.manifest.settings).toEqual([
    { pluginId: "x", pluginName: "x", key: "fold", ...setting },
  ])
  const bad = readManifest(
    manifest({ id: "x", ui: "src/ui.tsx", settings: { fold: { ...setting, type: "date" } } }),
  )
  expect(bad.kind === "invalid" && bad.reason).toContain("ivin.settings.fold.type")
})

test("a manifest carries its views, and a view with several placements adds a placement setting", () => {
  const view = {
    title: "Terminal",
    icon: "terminal",
    placements: ["subView", "dialog"],
    defaultPlacement: "subView",
  }
  const valid = readManifest(manifest({ id: "x", ui: "src/ui.tsx", views: { shell: view } }))
  expect(valid.kind === "valid" && valid.manifest.views).toEqual([
    { name: "shell", ...view, restore: true },
  ])
  expect(valid.kind === "valid" && valid.manifest.settings).toMatchObject([
    { pluginId: "x", key: "shell.placement", default: "subView", values: ["subView", "dialog"] },
  ])
  const bad = readManifest(
    manifest({
      id: "x",
      ui: "src/ui.tsx",
      views: { shell: { ...view, defaultPlacement: "sheet" } },
    }),
  )
  expect(bad.kind === "invalid" && bad.reason).toContain("ivin.views.shell.defaultPlacement")
})

test("a manifest may have a server half alone, or both halves", () => {
  const server = readManifest(manifest({ id: "x", server: "src/server.ts" }))
  expect(server).toMatchObject({ kind: "valid", manifest: { ui: null, server: "src/server.ts" } })
  const both = readManifest(manifest({ id: "x", ui: "src/ui.tsx", server: "src/server.ts" }))
  expect(both).toMatchObject({
    kind: "valid",
    manifest: { ui: "src/ui.tsx", server: "src/server.ts" },
  })
})
