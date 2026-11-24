import { expect, test } from "vitest"
import { appMenuTemplate } from "./app-menu.ts"

const roles = (items: ReturnType<typeof appMenuTemplate>): string[] =>
  items.flatMap((item) => [
    item.role ?? "",
    ...(Array.isArray(item.submenu) ? roles(item.submenu) : []),
  ])

test.each([["darwin"], ["linux"], ["win32"]] as const)(
  "the menu on %s leaves mod+W to the app and keeps the Edit items and Quit",
  (platform) => {
    const menu = appMenuTemplate(platform)
    expect(roles(menu)).not.toContain("close")
    expect(roles(menu)).toEqual(
      expect.arrayContaining(["editMenu", platform === "darwin" ? "appMenu" : "quit"]),
    )
  },
)
