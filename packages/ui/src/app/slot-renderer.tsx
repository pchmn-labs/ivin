import { RegistryContext, useAtomValue } from "@effect/atom-react"
import { Component, Suspense, useContext, type ComponentType, type ReactNode } from "react"
import type { SlotComponentProps, SlotName, SlotProps } from "@ivin/plugin-api/ui"
import { LoadingRows } from "../core/components/loading-rows/loading-rows.tsx"
import { contributionsAtom, type Contribution } from "../modules/plugin/atoms/contributions.ts"
import { reportPluginFailureAtom } from "../modules/plugin/atoms/report-plugin-failure.ts"
import { visibleContributions } from "../modules/plugin/rules/visible-contributions.ts"

class ContributionBoundary extends Component<
  { pluginId: string; children: ReactNode; quiet?: boolean; onError: (error: unknown) => void },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: unknown) {
    console.error(`plugin ${this.props.pluginId} failed`, error)
    this.props.onError(error)
  }

  override render() {
    if (!this.state.failed) return this.props.children
    if (this.props.quiet) return null
    const { pluginId } = this.props
    return (
      <p role="alert">
        plugin <code>{pluginId}</code> failed — see <code>ivin plugin logs {pluginId}</code>
      </p>
    )
  }
}

function useReportPluginError(pluginId: string) {
  const registry = useContext(RegistryContext)
  return (error: unknown) =>
    registry.set(reportPluginFailureAtom, {
      id: pluginId,
      reason: `Its slot failed while rendering: ${error instanceof Error ? error.message : String(error)}`,
    })
}

export function SlotContribution<S extends SlotName>({
  contribution,
  props,
}: {
  contribution: Contribution
  props: SlotProps[S]
}) {
  const Component = contribution.component as ComponentType<SlotProps[S]>
  const onError = useReportPluginError(contribution.pluginId)
  return (
    <ContributionBoundary pluginId={contribution.pluginId} onError={onError}>
      {/* A popup shows nothing until it opens; any other slot shows rows while its code loads. */}
      <Suspense
        fallback={contribution.slot === "window.overlay" ? null : <LoadingRows label="Loading" />}
      >
        <Component {...props} />
      </Suspense>
    </ContributionBoundary>
  )
}

// A contribution's badge renders nothing when it fails; its slot shows the failure.
export function ContributionBadge({ contribution }: { contribution: Contribution }) {
  const Badge = contribution.badge as ComponentType | undefined
  const onError = useReportPluginError(contribution.pluginId)
  if (Badge === undefined) return undefined
  return (
    <ContributionBoundary pluginId={contribution.pluginId} quiet onError={onError}>
      <Badge />
    </ContributionBoundary>
  )
}

export function Slot<S extends SlotName>({
  slot,
  props,
  tool,
}: {
  slot: S
  props: SlotProps[S]
  tool?: string
}) {
  const contributions = useAtomValue(contributionsAtom)
  return visibleContributions(contributions, slot, tool).map((c) => (
    <SlotContribution key={c.id} contribution={c} props={props} />
  ))
}

// A plugin names the slot as a string, which the plugin API's `Slot` keeps typed.
export function HostSlot({ slot, props, tool }: SlotComponentProps) {
  return (
    <Slot
      slot={slot as SlotName}
      props={props as SlotProps[SlotName]}
      {...(tool !== undefined && { tool })}
    />
  )
}
