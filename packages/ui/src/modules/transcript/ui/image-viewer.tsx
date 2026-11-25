import { useAtomValue } from "@effect/atom-react"
import { lazy } from "react"
import { LazyOnOpen } from "../../../core/components/lazy-on-open/lazy-on-open.tsx"
import { imageViewerAtom } from "../atoms/image-viewer.ts"

const ImageViewerDialog = lazy(() => import("./image-viewer-dialog.tsx"))

// Rendered by each session view; it opens for that session only.
export function ImageViewer({ sessionId }: { sessionId: string }) {
  const state = useAtomValue(imageViewerAtom)
  return (
    <LazyOnOpen open={state?.sessionId === sessionId}>
      <ImageViewerDialog sessionId={sessionId} />
    </LazyOnOpen>
  )
}
