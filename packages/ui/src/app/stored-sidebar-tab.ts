const KEY = "ivin.sidebar.tab"

export const readStoredSidebarTab = (): string | null => localStorage.getItem(KEY)

export const storeSidebarTab = (tab: string): void => localStorage.setItem(KEY, tab)
