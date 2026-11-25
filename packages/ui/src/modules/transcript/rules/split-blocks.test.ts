import { expect, test } from "vitest"
import { extendBlocks, splitBlocks } from "./split-blocks.ts"

test("splits top-level blocks", () => {
  const text = "# Title\n\nA paragraph.\n\n- one\n- two\n\n```ts\nconst a = 1\n```"
  const blocks = splitBlocks(text)
  expect(blocks).toHaveLength(4)
  expect(blocks[0]).toBe("# Title")
  expect(blocks[3]).toContain("const a = 1")
})

test("an unclosed code fence stays one block while it streams", () => {
  expect(splitBlocks("Intro\n\n```ts\nconst a = 1\n\nconst b = 2")).toHaveLength(2)
})

test("finished blocks keep their source when text is appended to the last one", () => {
  const before = splitBlocks("First\n\nSecond")
  const after = splitBlocks("First\n\nSecond, longer")
  expect(after[0]).toBe(before[0])
  expect(after[1]).not.toBe(before[1])
})

test("empty text has no blocks", () => {
  expect(splitBlocks("")).toEqual([])
})

const grow = (before: string, after: string) =>
  extendBlocks({ text: before, blocks: splitBlocks(before) }, after)

test("extending the text gives the same blocks as splitting it whole", () => {
  const before = "# Title\n\nFirst paragraph.\n\nSecond"
  for (const after of [`${before}, longer`, `${before}\n\nThird`, `${before}\n\n\`\`\`ts\nlet a`]) {
    expect(grow(before, after)).toEqual(splitBlocks(after))
  }
})

test("finished blocks are reused as they are", () => {
  const before = splitBlocks("One\n\nTwo")
  const after = extendBlocks({ text: "One\n\nTwo", blocks: before }, "One\n\nTwo and more")
  expect(after[0]).toBe(before[0])
})

test("text that does not extend the previous one is split whole", () => {
  expect(grow("One\n\nTwo", "Other")).toEqual(splitBlocks("Other"))
})
