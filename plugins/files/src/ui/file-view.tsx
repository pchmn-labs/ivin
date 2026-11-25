import { FileView, type ViewProps } from "@ivin/plugin-api/ui"

export function FileViewOf({ sessionId, params }: ViewProps) {
  const { path, line } = params
  if (typeof path !== "string") return null
  return <FileView sessionId={sessionId} path={path} {...(typeof line === "number" && { line })} />
}
