import { DiffView, useOpenView, type ViewProps } from "@ivin/plugin-api/ui"

export function DiffViewOf({ sessionId, params }: ViewProps) {
  const openView = useOpenView()
  const { path, kind } = params
  if (typeof path !== "string" || (kind !== "working" && kind !== "committed")) return null
  return (
    <DiffView
      sessionId={sessionId}
      path={path}
      kind={kind}
      onOpenFile={() => void openView(sessionId, "files/file", { path })}
    />
  )
}
