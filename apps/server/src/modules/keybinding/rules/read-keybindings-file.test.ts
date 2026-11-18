import { expect, test } from "vitest"
import { readKeybindingsFile } from "./read-keybindings-file.ts"

const none = { keybindings: [], problem: null }

test("a missing or empty file holds no keybinding", () => {
  expect(readKeybindingsFile(none, null)).toEqual(none)
  expect(readKeybindingsFile(none, "  \n")).toEqual(none)
})

test("the file's entries become keybindings, with no area when `when` is absent", () => {
  const text = `[
    { "key": "mod+b", "command": "sidebar.toggle" },
    { "key": "mod+enter", "command": "composer.send", "when": "composer" },
  ]`
  expect(readKeybindingsFile(none, text)).toEqual({
    keybindings: [
      { key: "mod+b", command: "sidebar.toggle", when: null },
      { key: "mod+enter", command: "composer.send", when: "composer" },
    ],
    problem: null,
  })
})

test("comments are allowed, as in the other files of ~/.ivin", () => {
  const text = `// mine\n[ /* toggle */ { "key": "mod+b", "command": "sidebar.toggle" } ]`
  expect(readKeybindingsFile(none, text).keybindings).toHaveLength(1)
})

test("an invalid file keeps the previous keybindings and names its problem", () => {
  const previous = {
    keybindings: [{ key: "mod+b", command: "sidebar.toggle", when: null }],
    problem: null,
  }
  expect(readKeybindingsFile(previous, "[{")).toEqual({
    keybindings: previous.keybindings,
    problem: { reason: "notJson", entry: null },
  })
  expect(readKeybindingsFile(previous, `{ "key": "mod+b" }`).problem).toEqual({
    reason: "notAList",
    entry: null,
  })
  expect(
    readKeybindingsFile(previous, `[{ "key": "mod+b", "command": "a" }, { "key": "x" }]`),
  ).toEqual({ keybindings: previous.keybindings, problem: { reason: "invalidEntry", entry: 2 } })
  expect(readKeybindingsFile(previous, `[{ "key": "", "command": "a" }]`).problem).toEqual({
    reason: "invalidEntry",
    entry: 1,
  })
  expect(
    readKeybindingsFile(previous, `[{ "key": "a", "command": "b", "when": 3 }]`).problem,
  ).toEqual({ reason: "invalidEntry", entry: 1 })
})
