import { Atom, type AtomRegistry } from "effect/reactivity"
import { archivedViewOpenAtom } from "../modules/session/atoms/archived-view.ts"
import { readStoredSidebarTab, storeSidebarTab } from "./stored-sidebar-tab.ts"

// The built-in `sessions` plugin's panel, or the panel that replaces it.
export const SESSIONS_TAB = "sessions/panel"

export const sidebarOpenAtom = Atom.make(true).pipe(Atom.keepAlive)

// Null until a tab is picked in this window, which then reads the one kept from the last launch.
const pickedTabAtom = Atom.make<string | null>(null).pipe(Atom.keepAlive)

export const sidebarTabAtom = Atom.readable(
  (get) => get(pickedTabAtom) ?? readStoredSidebarTab() ?? SESSIONS_TAB,
)

// Counts the requests to move the focus into the selected tab's panel.
export const panelFocusRequestAtom = Atom.make(0).pipe(Atom.keepAlive)

// `focus`: from a keybinding, where the focus is elsewhere in the window.
export const showSidebarTab = (
  registry: AtomRegistry.AtomRegistry,
  tab: string,
  { focus = false }: { readonly focus?: boolean } = {},
) => {
  registry.set(sidebarOpenAtom, true)
  registry.set(archivedViewOpenAtom, false)
  registry.set(pickedTabAtom, tab)
  storeSidebarTab(tab)
  if (focus) registry.set(panelFocusRequestAtom, registry.get(panelFocusRequestAtom) + 1)
}
