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
