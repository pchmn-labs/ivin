import { expect, test } from "vitest"
import { placementSettings, readManifestViews } from "./manifest-views.ts"

const shell = {
  title: "Terminal",
  icon: "terminal",
  placements: ["subView", "dialog"],
  defaultPlacement: "subView",
  restore: false,
}

test("no views key declares no view", () => {
  expect(readManifestViews(undefined)).toEqual({ kind: "valid", views: [] })
})

test("a view carries its title, icon, placements and default; restore defaults to true", () => {
  const { restore: _, ...kept } = shell
  expect(readManifestViews({ shell, file: kept })).toEqual({
    kind: "valid",
    views: [
      { name: "shell", ...shell },
      { name: "file", ...kept, restore: true },
    ],
  })
})

test.each([
  ["views that are not an object", []],
  ["a view that is not an object", { shell: 3 }],
  ["a bad name", { "1x": shell }],
  ["no title", { shell: { ...shell, title: "" } }],
  ["no icon", { shell: { ...shell, icon: undefined } }],
  ["no placements", { shell: { ...shell, placements: [] } }],
  ["an unknown placement", { shell: { ...shell, placements: ["subView", "panel"] } }],
  ["a repeated placement", { shell: { ...shell, placements: ["subView", "subView"] } }],
  ["a default outside the placements", { shell: { ...shell, defaultPlacement: "sheet" } }],
  ["a restore that is not a boolean", { shell: { ...shell, restore: "no" } }],
])("%s is invalid", (_, declared) => {
  expect(readManifestViews(declared).kind).toBe("invalid")
})

test("the reason names the default outside the placements", () => {
  expect(readManifestViews({ shell: { ...shell, defaultPlacement: "sheet" } })).toEqual({
    kind: "invalid",
    reason: "ivin.views.shell.defaultPlacement must be one of subView, dialog.",
  })
})

test("only a view with several placements gets a placement setting", () => {
  const reading = readManifestViews({
    shell,
    file: { ...shell, title: "File", placements: ["subView"] },
  })
  if (reading.kind !== "valid") throw new Error("invalid")
  expect(placementSettings("terminal", "Terminal", reading.views)).toEqual([
    {
      pluginId: "terminal",
      pluginName: "Terminal",
      key: "shell.placement",
      type: "string",
      default: "subView",
      values: ["subView", "dialog"],
      title: "Terminal placement",
      description: "Where Terminal opens: a tab beside the chat, or a dialog.",
    },
  ])
})
