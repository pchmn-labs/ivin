import { RegistryContext, useAtomValue } from "@effect/atom-react"
import { useContext, useEffect, useRef } from "react"
import { Tabs } from "../core/components/tabs/tabs.tsx"
import { contributionsAtom } from "../modules/plugin/atoms/contributions.ts"
import { shownPanel } from "../modules/plugin/rules/shown-panel.ts"
import { visibleContributions } from "../modules/plugin/rules/visible-contributions.ts"
import { panelFocusRequestAtom, showSidebarTab, sidebarTabAtom } from "./sidebar.ts"
import { ContributionBadge, SlotContribution } from "./slot-renderer.tsx"
import "./sidebar-tabs.css"

// In this order: the selected session row, a tree, then what the panel offers first.
const FOCUS_TARGETS = ['[aria-current="true"]', '[role="tree"]', 'button, input, [tabindex="0"]']

export function SidebarTabs() {
  const registry = useContext(RegistryContext)
  const contributions = useAtomValue(contributionsAtom)
  const panels = visibleContributions(contributions, "sidebar.panel")
  const all = contributions.filter((contribution) => contribution.slot === "sidebar.panel")
  const panel = shownPanel(all, panels, useAtomValue(sidebarTabAtom))
  const focusRequest = useAtomValue(panelFocusRequestAtom)
  const content = useRef<HTMLDivElement>(null)
  const handledRequest = useRef(focusRequest)
  useEffect(() => {
    if (focusRequest === handledRequest.current) return
    handledRequest.current = focusRequest
    for (const selector of FOCUS_TARGETS) {
      const target = content.current?.querySelector<HTMLElement>(selector)
      if (target) return target.focus()
    }
  }, [focusRequest])

  return (
    <Tabs
      aria-label="Sidebar"
      tabs={panels.map((c) => ({
        value: c.id,
        label: c.title ?? c.pluginId,
        ...(c.badge !== undefined && { badge: <ContributionBadge contribution={c} /> }),
      }))}
      value={panel?.id ?? ""}
      onValueChange={(tab) => showSidebarTab(registry, tab)}
    >
      <div ref={content} className="iv-sidebar-tabs__panel">
        {panel === undefined ? null : (
          <SlotContribution<"sidebar.panel"> contribution={panel} props={{}} />
        )}
      </div>
    </Tabs>
  )
}
