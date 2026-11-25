import { RegistryContext, useAtomValue } from "@effect/atom-react"
import type { DiffViewProps, FileViewProps } from "@ivin/plugin-api/ui"
import { Suspense, lazy, useContext, useEffect } from "react"
import { LoadingRows } from "../core/components/loading-rows/loading-rows.tsx"
import { shownLinesOf } from "../modules/file/atoms/shown-lines.ts"
import { openSessionsAtom } from "../modules/session/atoms/open-sessions.ts"

// CodeMirror comes with these two views, so the window does not load it before one opens.
const DiffView = lazy(() =>
  import("../modules/file/ui/diff-view.tsx").then((m) => ({ default: m.DiffView })),
)
const FileView = lazy(() =>
  import("../modules/file/ui/file-view.tsx").then((m) => ({ default: m.FileView })),
)

const useWorkingFolder = (sessionId: string) =>
  useAtomValue(openSessionsAtom).find((s) => s.id === sessionId)?.workingFolder

let lastRequest = 0

export function HostFileView({ sessionId, path, line }: FileViewProps) {
  const workingFolder = useWorkingFolder(sessionId)
  const registry = useContext(RegistryContext)
  useEffect(() => {
    if (workingFolder === undefined || line === undefined) return
    registry.set(shownLinesOf(sessionId, workingFolder, path), {
      start: line,
      end: line,
      request: ++lastRequest,
    })
  }, [registry, sessionId, workingFolder, path, line])
  if (workingFolder === undefined) return null
  return (
    <Suspense fallback={<LoadingRows label="Loading" />}>
      <FileView sessionId={sessionId} workingFolder={workingFolder} path={path} />
    </Suspense>
  )
}

export function HostDiffView({ sessionId, path, kind, onOpenFile }: DiffViewProps) {
  const workingFolder = useWorkingFolder(sessionId)
  if (workingFolder === undefined) return null
  return (
    <Suspense fallback={<LoadingRows label="Loading" />}>
      <DiffView
        kind={kind === "committed" ? "committed_diff" : "diff"}
        sessionId={sessionId}
        workingFolder={workingFolder}
        path={path}
        onOpenFile={onOpenFile}
      />
    </Suspense>
  )
}
