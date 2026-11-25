import { expect, test } from "vitest"
import { viewTitle } from "./view-title.ts"

const view = { view: "t/v", params: { name: "a" } }
const declaration = {
  id: "t/v",
  pluginId: "t",
  name: "v",
  title: "Thing",
  icon: "file",
  placements: ["subView"],
  defaultPlacement: "subView",
  restore: true,
} as const
const registration = { id: "t/v", pluginId: "t", component: () => null }

test("the registration's title wins over the manifest's", () => {
  expect(
    viewTitle(
      { ...registration, title: (p) => `Thing ${typeof p["name"] === "string" ? p["name"] : ""}` },
      declaration,
      view,
    ),
  ).toBe("Thing a")
})

test("the manifest's title shows when there is no title function, or it throws", () => {
  expect(viewTitle(registration, declaration, view)).toBe("Thing")
  expect(
    viewTitle(
      {
        ...registration,
        title: () => {
          throw new Error("boom")
        },
      },
      declaration,
      view,
    ),
  ).toBe("Thing")
})

test("the view's id shows for a view nothing declares", () => {
  expect(viewTitle(undefined, undefined, view)).toBe("t/v")
})
