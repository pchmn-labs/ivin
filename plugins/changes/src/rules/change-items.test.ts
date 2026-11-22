import { expect, test } from "vitest"
import { changeItems } from "./change-items.ts"

test("splits each path into its name and folder, and says where a renamed file comes from", () => {
  expect(
    changeItems([
      { path: "README.md", previousPath: null, status: "modified", added: 1, deleted: 0 },
      { path: "src/lib/b.ts", previousPath: "a.ts", status: "renamed", added: 0, deleted: 0 },
    ]),
  ).toEqual([
    { id: "README.md", name: "README.md", folder: "", status: "modified", added: 1, deleted: 0 },
    {
      id: "src/lib/b.ts",
      name: "b.ts",
      folder: "src/lib",
      status: "renamed",
      added: 0,
      deleted: 0,
      title: "Renamed from a.ts",
    },
  ])
})
