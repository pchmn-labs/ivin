import { expect, test } from "vitest"
import { findCommand, resolveKeybindings } from "./resolve-keybindings.ts"
import { normalizeKey } from "./key.ts"

const mac = { mac: true }
const key = (text: string) => normalizeKey(text, mac)!
const defaults = [
  { key: "mod+\\", command: "sidebar.toggle", when: null },
  { key: "escape", command: "session.interrupt", when: null },
  { key: "enter", command: "composer.send", when: "composer" },
]
const resolve = (user: Parameters<typeof resolveKeybindings>[0]["user"]) =>
  resolveKeybindings({ defaults, user, platform: mac })

test("with no user file, the defaults apply", () => {
  const { keybindings } = resolve([])
  expect(findCommand(keybindings, key("mod+\\"), [])).toBe("sidebar.toggle")
  expect(findCommand(keybindings, key("enter"), [])).toBeNull()
  expect(findCommand(keybindings, key("enter"), ["composer"])).toBe("composer.send")
})

test("the closest area wins, then the keybindings with no area", () => {
  const { keybindings } = resolveKeybindings({
    defaults: [
      { key: "escape", command: "session.interrupt", when: null },
      { key: "escape", command: "composer.clear", when: "composer" },
      { key: "escape", command: "sheet.close", when: "sheet" },
    ],
    user: [],
    platform: mac,
  })
  expect(findCommand(keybindings, key("escape"), ["sheet", "composer"])).toBe("sheet.close")
  expect(findCommand(keybindings, key("escape"), ["composer"])).toBe("composer.clear")
  expect(findCommand(keybindings, key("escape"), ["sessionList"])).toBe("session.interrupt")
})

test("moving the sidebar toggle to mod+b removes it from mod+\\", () => {
  const { keybindings } = resolve([
    { key: "mod+b", command: "sidebar.toggle", when: null },
    { key: "mod+\\", command: "-sidebar.toggle", when: null },
  ])
  expect(findCommand(keybindings, key("mod+b"), [])).toBe("sidebar.toggle")
  expect(findCommand(keybindings, key("mod+\\"), [])).toBeNull()
})

test("a removal names the command on that key, and its area when it gives one", () => {
  const removedInComposer = resolve([{ key: "enter", command: "-composer.send", when: "composer" }])
  expect(findCommand(removedInComposer.keybindings, key("enter"), ["composer"])).toBeNull()
  const elsewhere = resolve([{ key: "enter", command: "-composer.send", when: "sessionList" }])
  expect(findCommand(elsewhere.keybindings, key("enter"), ["composer"])).toBe("composer.send")
  const otherCommand = resolve([{ key: "enter", command: "-sidebar.toggle", when: null }])
  expect(findCommand(otherCommand.keybindings, key("enter"), ["composer"])).toBe("composer.send")
})

test("the user's keybinding wins over a default on the same key and area, and the conflict is reported", () => {
  const { keybindings, conflicts } = resolve([
    { key: "mod+\\", command: "files.toggle", when: null },
  ])
  expect(findCommand(keybindings, key("mod+\\"), [])).toBe("files.toggle")
  expect(conflicts).toEqual([
    { key: "mod+\\", when: null, defaultCommand: "sidebar.toggle", userCommand: "files.toggle" },
  ])
})

test("a key written differently still matches, and a key the app cannot read is left out", () => {
  const { keybindings, unreadable } = resolve([
    { key: "Cmd+B", command: "sidebar.toggle", when: null },
    { key: "mod+k mod+s", command: "files.save", when: null },
  ])
  expect(findCommand(keybindings, key("mod+b"), [])).toBe("sidebar.toggle")
  expect(unreadable).toEqual(["mod+k mod+s"])
})
