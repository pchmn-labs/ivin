import { Suspense, lazy } from "react"

const ImagePreviewCard = lazy(() => import("./image-preview-card.tsx"))

// Mounted while the pointer is on the anchor; nothing shows until its code has loaded.
export function ImagePreview(props: { anchor: Element; number: number; src: string }) {
  return (
    <Suspense fallback={null}>
      <ImagePreviewCard {...props} />
    </Suspense>
  )
}
