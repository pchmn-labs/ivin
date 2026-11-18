import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { findCommand } from "../rules/resolve-keybindings.ts"
import { normalizeKey } from "../rules/key.ts"
import { keybindingsFileProblemAtom, keybindingsOf } from "./keybindings.ts"

const mac = { mac: true }

test("the user's file changes the keybindings while the app runs, and its problem is kept apart", async () => {
  const { server, registry } = makeTestRegistry()
  const commandOn = (key: string) =>
    findCommand(registry.get(keybindingsOf(true)), normalizeKey(key, mac)!, [])
  registry.mount(keybindingsOf(true))
  registry.mount(keybindingsFileProblemAtom)
  await vi.waitFor(() => expect(commandOn("mod+\\")).toBe("sidebar.toggle"))

  const moved = [
    { key: "mod+b", command: "sidebar.toggle", when: null },
    { key: "mod+\\", command: "-sidebar.toggle", when: null },
  ]
  server.setUserKeybindings({ keybindings: moved, problem: null })
  await vi.waitFor(() => expect(commandOn("mod+b")).toBe("sidebar.toggle"))
  expect(commandOn("mod+\\")).toBeNull()

  server.setUserKeybindings({ keybindings: moved, problem: { reason: "notJson", entry: null } })
  await vi.waitFor(() =>
    expect(registry.get(keybindingsFileProblemAtom)).toEqual({ reason: "notJson", entry: null }),
  )
  expect(commandOn("mod+b")).toBe("sidebar.toggle")
})
