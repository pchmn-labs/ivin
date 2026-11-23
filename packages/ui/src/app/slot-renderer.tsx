import { useAtomValue } from "@effect/atom-react"
import { Component, type ComponentType, type ReactNode } from "react"
import type { SlotComponentProps, SlotName, SlotProps } from "@ivin/plugin-api/ui"
import { contributionsAtom, type Contribution } from "../modules/plugin/atoms/contributions.ts"
import { visibleContributions } from "../modules/plugin/rules/visible-contributions.ts"

class ContributionBoundary extends Component<
  { pluginId: string; children: ReactNode; quiet?: boolean },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: unknown) {
    console.error(`plugin ${this.props.pluginId} failed`, error)
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

export function SlotContribution<S extends SlotName>({
  contribution,
  props,
}: {
  contribution: Contribution
  props: SlotProps[S]
}) {
  const Component = contribution.component as ComponentType<SlotProps[S]>
  return (
    <ContributionBoundary pluginId={contribution.pluginId}>
      <Component {...props} />
    </ContributionBoundary>
  )
}

// A contribution's badge renders nothing when it fails; its slot shows the failure.
export function ContributionBadge({ contribution }: { contribution: Contribution }) {
  const Badge = contribution.badge as ComponentType | undefined
  if (Badge === undefined) return undefined
  return (
    <ContributionBoundary pluginId={contribution.pluginId} quiet>
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
