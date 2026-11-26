import { expect, test } from "vitest"
import { completionWord, pickedText } from "./completion-word.ts"

test("a / that starts the draft opens on the letters after it", () => {
  expect(completionWord("/", 1, "/", true)).toEqual({ start: 0, end: 1, query: "" })
  expect(completionWord("/rev", 4, "/", true)).toEqual({ start: 0, end: 4, query: "rev" })
  expect(completionWord("/review some text", 3, "/", true)).toEqual({
    start: 0,
    end: 7,
    query: "review",
  })
})

test("a / in the middle of a sentence or in a path opens nothing", () => {
  expect(completionWord("see /rev", 8, "/", true)).toBeNull()
  expect(completionWord("src/a", 5, "/", true)).toBeNull()
  expect(completionWord("/review then", 12, "/", true)).toBeNull()
})

test("a trigger anywhere opens when the completion does not need the start", () => {
  expect(completionWord("look at @src", 12, "@", false)).toEqual({
    start: 8,
    end: 12,
    query: "src",
  })
  expect(completionWord("mail a@b", 8, "@", false)).toBeNull()
})

test("a caret before the trigger, or no caret, opens nothing", () => {
  expect(completionWord("/rev", 0, "/", true)).toBeNull()
  expect(completionWord("/rev", null, "/", true)).toBeNull()
})

test("a pick adds a space after the label unless one follows already", () => {
  expect(pickedText({ start: 0, end: 4, query: "rev" }, "/", "review", "/rev")).toBe("/review ")
  expect(pickedText({ start: 0, end: 4, query: "rev" }, "/", "review", "/rev it")).toBe("/review")
})
