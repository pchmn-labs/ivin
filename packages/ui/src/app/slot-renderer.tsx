import { useAtomValue } from "@effect/atom-react"
import { Component, type ComponentType, type ReactNode } from "react"
import type { SlotName, SlotProps } from "@ivin/plugin-api/ui"
import { contributionsAtom, visibleContributions } from "./plugin-registry.ts"

class ContributionBoundary extends Component<
  { pluginId: string; children: ReactNode },
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
    const { pluginId } = this.props
    return (
      <p role="alert">
        plugin <code>{pluginId}</code> failed — see <code>ivin plugin logs {pluginId}</code>
      </p>
    )
  }
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
  return visibleContributions(contributions, slot, tool).map((c) => {
    const Contribution = c.component as ComponentType<SlotProps[S]>
    return (
      <ContributionBoundary key={c.id} pluginId={c.pluginId}>
        <Contribution {...props} />
      </ContributionBoundary>
    )
  })
}
