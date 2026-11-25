import { useAtomValue } from "@effect/atom-react"
import type { SubView } from "@ivin/contracts/tab"
import type { ViewPlacement } from "@ivin/plugin-api/ui"
import { Suspense } from "react"
import { LoadingRows } from "../../../core/components/loading-rows/loading-rows.tsx"
import {
  ContributionBoundary,
  PluginFailureMessage,
  useReportPluginError,
} from "../../../app/slot-renderer.tsx"
import { registeredViewsAtom } from "../atoms/registered-views.ts"
import { registeredViewOf } from "../rules/view-title.ts"

export function ViewBody({
  sessionId,
  view,
  placement,
  close,
}: {
  sessionId: string
  view: SubView
  placement: ViewPlacement
  close: () => void
}) {
  const registration = registeredViewOf(useAtomValue(registeredViewsAtom), view)
  const pluginId = registration?.pluginId ?? view.view.slice(0, view.view.indexOf("/"))
  const onError = useReportPluginError(pluginId, "view")
  if (registration === undefined) return <PluginFailureMessage pluginId={pluginId} />
  const Component = registration.component
  return (
    <ContributionBoundary pluginId={pluginId} onError={onError}>
      <Suspense fallback={<LoadingRows label="Loading" />}>
        <Component sessionId={sessionId} params={view.params} placement={placement} close={close} />
      </Suspense>
    </ContributionBoundary>
  )
}
