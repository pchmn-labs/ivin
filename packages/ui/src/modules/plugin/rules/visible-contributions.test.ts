import { expect, test } from "vitest"
import { visibleContributions } from "./visible-contributions.ts"

const c = (id: string, extra: object = {}) => ({
  id,
  slot: "composer.status",
  order: 0,
  replaces: undefined as string | undefined,
  tool: undefined as string | undefined,
  ...extra,
})
const ids = (list: ReadonlyArray<{ id: string }>) => list.map((x) => x.id)

test("contributions come by ascending order, ties by registration", () => {
  const all = [c("a", { order: 2 }), c("b", { order: 1 }), c("c", { order: 1 })]
  expect(ids(visibleContributions(all, "composer.status"))).toEqual(["b", "c", "a"])
})

test("only the slot's contributions and the matching tool's show", () => {
  const all = [
    c("a"),
    c("b", { slot: "transcript.toolCall", tool: "Bash" }),
    c("d", { slot: "transcript.toolCall" }),
  ]
  expect(ids(visibleContributions(all, "transcript.toolCall", "Read"))).toEqual(["d"])
  expect(ids(visibleContributions(all, "transcript.toolCall", "Bash"))).toEqual(["b", "d"])
})

test("a contribution hides the one it replaces", () => {
  const all = [c("a"), c("b", { replaces: "a" })]
  expect(ids(visibleContributions(all, "composer.status"))).toEqual(["b"])
})

test("a hidden contribution does not hide the one it replaces", () => {
  const all = [c("a"), c("b", { replaces: "a" }), c("c", { replaces: "b" })]
  expect(ids(visibleContributions(all, "composer.status"))).toEqual(["a", "c"])
})
