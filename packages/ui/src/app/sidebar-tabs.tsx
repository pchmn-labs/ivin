import { RegistryContext, useAtomValue } from "@effect/atom-react"
import type { Project } from "@ivin/contracts/project"
import { useContext, useEffect, useRef } from "react"
import { Tabs } from "../core/components/tabs/tabs.tsx"
import { contributionsAtom } from "../modules/plugin/atoms/contributions.ts"
import { visibleContributions } from "../modules/plugin/rules/visible-contributions.ts"
import { SessionList } from "../modules/session/ui/session-list.tsx"
import { SESSIONS_TAB, panelFocusRequestAtom, showSidebarTab, sidebarTabAtom } from "./sidebar.ts"
import { SlotContribution } from "./slot-renderer.tsx"
import "./sidebar-tabs.css"

// In this order: the selected session row, a tree, then what the panel offers first.
const FOCUS_TARGETS = ['[aria-current="true"]', '[role="tree"]', 'button, input, [tabindex="0"]']

export function SidebarTabs({ project }: { project: Project }) {
  const registry = useContext(RegistryContext)
  const panels = visibleContributions(useAtomValue(contributionsAtom), "sidebar.panel")
  const picked = useAtomValue(sidebarTabAtom)
  const panel = panels.find((contribution) => contribution.id === picked)
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
      tabs={[
        { value: SESSIONS_TAB, label: "Sessions" },
        ...panels.map((c) => ({ value: c.id, label: c.title ?? c.pluginId })),
      ]}
      value={panel?.id ?? SESSIONS_TAB}
      onValueChange={(tab) => showSidebarTab(registry, tab)}
    >
      <div
        ref={content}
        className={panel === undefined ? "iv-sidebar-tabs__sessions" : "iv-sidebar-tabs__panel"}
      >
        {panel === undefined ? (
          <SessionList projectPath={project.path} projectName={project.name} />
        ) : (
          <SlotContribution<"sidebar.panel"> contribution={panel} props={{}} />
        )}
      </div>
    </Tabs>
  )
}
