import type { ProjectTabs } from "@ivin/contracts/tab"

// Selects the next tab, else the previous, as the server does.
export const closeTabs = (bar: ProjectTabs, sessionIds: ReadonlySet<string>): ProjectTabs =>
  bar.tabs.reduce((current, tab) => {
    if (!sessionIds.has(tab.sessionId)) return current
    const order = current.tabs.map((each) => each.sessionId)
    const index = order.indexOf(tab.sessionId)
    return {
      ...current,
      tabs: current.tabs.filter((each) => each.sessionId !== tab.sessionId),
      selectedSessionId:
        current.selectedSessionId === tab.sessionId
          ? (order[index + 1] ?? order[index - 1] ?? null)
          : current.selectedSessionId,
    }
  }, bar)

// Puts back a tab whose close failed, where it was and selected if it was.
export const reopenTab = (
  bar: ProjectTabs,
  before: ProjectTabs,
  sessionId: string,
): ProjectTabs => {
  const tab = before.tabs.find((each) => each.sessionId === sessionId)
  if (!tab || bar.tabs.some((each) => each.sessionId === sessionId)) return bar
  const at = Math.min(before.tabs.indexOf(tab), bar.tabs.length)
  return {
    ...bar,
    tabs: [...bar.tabs.slice(0, at), tab, ...bar.tabs.slice(at)],
    selectedSessionId: before.selectedSessionId === sessionId ? sessionId : bar.selectedSessionId,
  }
}
