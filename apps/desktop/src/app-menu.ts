import type { MenuItemConstructorOptions } from "electron"

// Electron's default menu closes the window on mod+W, which the app binds to closing a tab.
export const appMenuTemplate = (platform: NodeJS.Platform): MenuItemConstructorOptions[] => {
  const window: MenuItemConstructorOptions = {
    role: "windowMenu",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      ...(platform === "darwin" ? ([{ type: "separator" }, { role: "front" }] as const) : []),
    ],
  }
  return platform === "darwin"
    ? [{ role: "appMenu" }, { role: "editMenu" }, { role: "viewMenu" }, window]
    : [
        { label: "File", submenu: [{ role: "quit" }] },
        { role: "editMenu" },
        { role: "viewMenu" },
        window,
      ]
}
