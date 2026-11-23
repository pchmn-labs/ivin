import { RegistryContext, useAtomValue } from "@effect/atom-react"
import { Component, useContext, type ReactNode } from "react"
import { FailureHeader, FailureSkeleton } from "../core/components/failure-state/failure-state.tsx"
import { writeErrorAtom } from "../modules/log/atoms/write-error.ts"
import { errorReport } from "../modules/log/rules/error-report.ts"
import { tabsOf } from "../modules/tab/atoms/list-tabs.ts"
import "./failure-boundary.css"

type Scope = "window" | "area"

const MESSAGES: Record<Scope, string> = {
  window: "ivin could not draw the window. Your drafts and unsaved edits are kept.",
  area: "This part of the window could not be drawn. The sidebar still works.",
}

function Failed({ scope, onRetry }: { scope: Scope; onRetry: () => void }) {
  return (
    <div className="iv-failure" data-scope={scope}>
      <FailureHeader
        message={MESSAGES[scope]}
        onRetry={onRetry}
        {...(scope === "window" && {
          action: { label: "Reload window", onSelect: () => window.location.reload() },
        })}
      />
      <FailureSkeleton />
    </div>
  )
}

interface BoundaryProps {
  scope: Scope
  resetKey?: string | undefined
  onError: (error: unknown) => void
  children: ReactNode
}

interface BoundaryState {
  failed: boolean
  resetKey: string | undefined
}

class Boundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState) {
    if (props.resetKey === state.resetKey) return null
    return { failed: false, resetKey: props.resetKey }
  }

  override componentDidCatch(error: unknown) {
    this.props.onError(error)
  }

  override render() {
    if (!this.state.failed) return this.props.children
    return <Failed scope={this.props.scope} onRetry={() => this.setState({ failed: false })} />
  }
}

function useLogRenderError() {
  const registry = useContext(RegistryContext)
  return (error: unknown) => {
    console.error("render error", error)
    registry.set(writeErrorAtom, errorReport("render error", error))
  }
}

// Sits inside RegistryProvider, so Retry keeps every atom: drafts and unsaved edits.
export function WindowFailureBoundary({ children }: { children: ReactNode }) {
  const onError = useLogRenderError()
  return (
    <Boundary scope="window" onError={onError}>
      {children}
    </Boundary>
  )
}

export function AreaFailureBoundary({
  resetKey,
  children,
}: {
  resetKey?: string | undefined
  children: ReactNode
}) {
  const onError = useLogRenderError()
  return (
    <Boundary scope="area" resetKey={resetKey} onError={onError}>
      {children}
    </Boundary>
  )
}

export function MainAreaBoundary({
  projectPath,
  children,
}: {
  projectPath: string
  children: ReactNode
}) {
  const { selectedSessionId } = useAtomValue(tabsOf(projectPath).value)
  return (
    <AreaFailureBoundary resetKey={selectedSessionId ?? undefined}>{children}</AreaFailureBoundary>
  )
}
