import { expect, test } from "vitest"
import { readManifest } from "./manifest.ts"

const manifest = (ivin: unknown) => JSON.stringify({ name: "x", ivin })

test("a manifest with an id and a UI entry is valid, and its name defaults to its id", () => {
  expect(readManifest(manifest({ id: "hello-world", ui: "src/ui.tsx" }))).toEqual({
    kind: "valid",
    manifest: { id: "hello-world", name: "hello-world", ui: "src/ui.tsx" },
  })
})

test.each([
  [null, "no package.json"],
  ["{", "not valid JSON"],
  [JSON.stringify({ name: "x" }), "no ivin key"],
  [manifest({ id: "Hello", ui: "src/ui.tsx" }), "ivin.id"],
  [manifest({ id: "../x", ui: "src/ui.tsx" }), "ivin.id"],
  [manifest({ id: "x", name: 3, ui: "src/ui.tsx" }), "ivin.name"],
  [manifest({ id: "x", server: "src/server.ts" }), "ivin.ui"],
])("%s is invalid, saying %s", (text, reason) => {
  const reading = readManifest(text)
  expect(reading.kind).toBe("invalid")
  expect(reading.kind === "invalid" && reading.reason).toContain(reason)
})
