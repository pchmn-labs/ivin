import { expect, test } from "vitest"
import { firstMessagePrompt, readingOf } from "./first-message-reading.ts"

test("the prompt holds the message, cut when too long", () => {
  const prompt = firstMessagePrompt(`fix the tab drag ${"x".repeat(10_000)}`)

  expect(prompt).toContain("fix the tab drag")
  expect(prompt.length).toBeLessThan(6_000)
})

test("a reply gives the title and the cited issue or pull request", () => {
  const reading = readingOf(
    '{"title": "Branch changes and discard", "workItem": {"kind": "issue", "number": 127}}',
    "implement #127",
  )

  expect(reading).toEqual({
    title: "Branch changes and discard",
    citation: { kind: "issue", number: 127 },
  })
})

test("a reply wrapped in a code fence or in prose is still read", () => {
  const reading = readingOf(
    'Here it is:\n```json\n{"title": "Tab drag reorder", "workItem": null}\n```',
    "fix tab drag",
  )

  expect(reading).toEqual({ title: "Tab drag reorder", citation: null })
})

test("a title loses its quotes, its trailing period and its extra lines, and is cut to 60 characters", () => {
  expect(readingOf('{"title": "\\"Fix the drag.\\"\\nmore"}', "x").title).toBe("Fix the drag")
  expect(readingOf(`{"title": "${"word ".repeat(20)}"}`, "x").title).toHaveLength(60)
})

test("a number the message does not hold is no citation", () => {
  const reading = readingOf(
    '{"title": "Tab drag", "workItem": {"kind": "pr", "number": 42}}',
    "fix the tab drag from #412",
  )

  expect(reading.citation).toBeNull()
})

test("a reply that is not the expected JSON gives nothing", () => {
  expect(readingOf("I cannot help with that.", "x")).toEqual({ title: null, citation: null })
  expect(readingOf('{"title": 3}', "x")).toEqual({ title: null, citation: null })
  expect(readingOf('{"title": "  "}', "x")).toEqual({ title: null, citation: null })
})
