import { expect, test } from "vitest"
import { eventKey, formatKey, normalizeKey } from "./key.ts"

const press = (
  key: string,
  modifiers: Partial<Record<"meta" | "ctrl" | "alt" | "shift", boolean>> = {},
  code = "",
) => ({
  key,
  code,
  metaKey: modifiers.meta ?? false,
  ctrlKey: modifiers.ctrl ?? false,
  altKey: modifiers.alt ?? false,
  shiftKey: modifiers.shift ?? false,
})

test("mod is ⌘ on macOS and Ctrl elsewhere", () => {
  expect(normalizeKey("mod+\\", { mac: true })).toBe(normalizeKey("cmd+\\", { mac: true }))
  expect(normalizeKey("mod+\\", { mac: false })).toBe(normalizeKey("ctrl+\\", { mac: false }))
  expect(normalizeKey("mod+\\", { mac: true })).toBe(
    eventKey(press("\\", { meta: true }, "Backslash")),
  )
  expect(normalizeKey("mod+\\", { mac: false })).toBe(
    eventKey(press("\\", { ctrl: true }, "Backslash")),
  )
})

test("modifier order, case and aliases do not matter", () => {
  const mac = { mac: true }
  expect(normalizeKey("Shift+Mod+B", mac)).toBe(normalizeKey("cmd+shift+b", mac))
  expect(normalizeKey("esc", mac)).toBe(normalizeKey("Escape", mac))
  expect(normalizeKey("return", mac)).toBe(normalizeKey("enter", mac))
  expect(normalizeKey("option+a", mac)).toBe(normalizeKey("alt+a", mac))
})

test("a key the app cannot match is null: a sequence, an empty key, an unknown modifier", () => {
  const mac = { mac: true }
  expect(normalizeKey("mod+k mod+s", mac)).toBeNull()
  expect(normalizeKey("mod+", mac)).toBeNull()
  expect(normalizeKey("hyper+a", mac)).toBeNull()
  expect(normalizeKey("", mac)).toBeNull()
})

test("a pressed key matches its written form", () => {
  const mac = { mac: true }
  expect(eventKey(press("Enter"))).toBe(normalizeKey("enter", mac))
  expect(eventKey(press("Escape"))).toBe(normalizeKey("escape", mac))
  expect(eventKey(press("B", { meta: true, shift: true }, "KeyB"))).toBe(
    normalizeKey("mod+shift+b", mac),
  )
  // Option changes the character on macOS: the physical key decides.
  expect(eventKey(press("∫", { alt: true }, "KeyB"))).toBe(normalizeKey("alt+b", mac))
  expect(eventKey(press(" ", {}, "Space"))).toBe(normalizeKey("space", mac))
})

test("a key shows as the platform writes it", () => {
  expect(formatKey("mod+\\", { mac: true })).toBe("⌘\\")
  expect(formatKey("mod+b", { mac: true })).toBe("⌘B")
  expect(formatKey("mod+shift+enter", { mac: true })).toBe("⇧⌘Enter")
  expect(formatKey("escape", { mac: true })).toBe("Esc")
  expect(formatKey("mod+\\", { mac: false })).toBe("Ctrl+\\")
  expect(formatKey("alt+shift+b", { mac: false })).toBe("Shift+Alt+B")
})
