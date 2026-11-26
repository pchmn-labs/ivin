import { expect, test } from "vitest"
import { sameSubView, subViewKey } from "./tab.ts"

test("two sub-views are the same when the view and every parameter match, whatever the order of the parameters", () => {
  const diff = { view: "changes/diff", params: { kind: "working", path: "a" } }

  expect(sameSubView(diff, { view: "changes/diff", params: { path: "a", kind: "working" } })).toBe(
    true,
  )
  expect(sameSubView(diff, { view: "changes/diff", params: { kind: "working", path: "b" } })).toBe(
    false,
  )
  expect(sameSubView(diff, { view: "files/file", params: diff.params })).toBe(false)
})

test("the order of the keys at every level of the parameters does not change a sub-view's key", () => {
  const key = subViewKey({ view: "p/v", params: { a: { x: 1, y: [{ m: 1, n: 2 }] }, b: null } })

  expect(subViewKey({ view: "p/v", params: { b: null, a: { y: [{ n: 2, m: 1 }], x: 1 } } })).toBe(
    key,
  )
})
