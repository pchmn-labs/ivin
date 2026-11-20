import { expect, test } from "vitest"
import { eventKeys, formatKey, normalizeKey } from "./key.ts"

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

const mac = { mac: true }
const pressing = (text: string, platform = mac) =>
  expect.arrayContaining([normalizeKey(text, platform)])

test("mod is ⌘ on macOS and Ctrl elsewhere", () => {
  expect(normalizeKey("mod+\\", mac)).toBe(normalizeKey("cmd+\\", mac))
  expect(normalizeKey("mod+\\", { mac: false })).toBe(normalizeKey("ctrl+\\", { mac: false }))
  expect(eventKeys(press("\\", { meta: true }, "Backslash"))).toEqual(pressing("mod+\\"))
  expect(eventKeys(press("\\", { ctrl: true }, "Backslash"))).toEqual(
    pressing("mod+\\", { mac: false }),
  )
})

test("modifier order, case and aliases do not matter", () => {
  expect(normalizeKey("Shift+Mod+B", mac)).toBe(normalizeKey("cmd+shift+b", mac))
  expect(normalizeKey("esc", mac)).toBe(normalizeKey("Escape", mac))
  expect(normalizeKey("return", mac)).toBe(normalizeKey("enter", mac))
  expect(normalizeKey("option+a", mac)).toBe(normalizeKey("alt+a", mac))
})

test("a key the app cannot match is null: a sequence, an empty key, an unknown modifier", () => {
  expect(normalizeKey("mod+k mod+s", mac)).toBeNull()
  expect(normalizeKey("mod+", mac)).toBeNull()
  expect(normalizeKey("hyper+a", mac)).toBeNull()
  expect(normalizeKey("", mac)).toBeNull()
})

test("a pressed key matches its written form", () => {
  expect(eventKeys(press("Enter"))).toEqual(pressing("enter"))
  expect(eventKeys(press("Escape"))).toEqual(pressing("escape"))
  expect(eventKeys(press("B", { meta: true, shift: true }, "KeyB"))).toEqual(
    pressing("mod+shift+b"),
  )
  expect(eventKeys(press(" ", {}, "Space"))).toEqual(pressing("space"))
})

test("Option changes the character on macOS: alt with a letter or digit matches the physical key", () => {
  expect(eventKeys(press("∫", { alt: true }, "KeyB"))).toEqual(pressing("alt+b"))
})

test("a symbol matches whatever Shift or Option the layout needs to type it", () => {
  // `\` is Option+Shift+7 on a German Mac.
  expect(eventKeys(press("\\", { meta: true, alt: true, shift: true }, "Digit7"))).toEqual(
    pressing("mod+\\"),
  )
  expect(eventKeys(press("?", { shift: true }, "Slash"))).toEqual(pressing("?"))
  expect(eventKeys(press("Enter", { shift: true }))).not.toEqual(pressing("enter"))
})

test("a key shows as the platform writes it", () => {
  expect(formatKey("mod+\\", mac)).toBe("⌘\\")
  expect(formatKey("mod+b", mac)).toBe("⌘B")
  expect(formatKey("mod+shift+enter", mac)).toBe("⇧⌘Enter")
  expect(formatKey("escape", mac)).toBe("Esc")
  expect(formatKey("mod+\\", { mac: false })).toBe("Ctrl+\\")
  expect(formatKey("alt+shift+b", { mac: false })).toBe("Shift+Alt+B")
  expect(formatKey("mod+shift+backspace", mac)).toBe("⇧⌘⌫")
  expect(formatKey("mod+shift+backspace", { mac: false })).toBe("Ctrl+Shift+Backspace")
})
