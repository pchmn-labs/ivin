import { Atom } from "effect/reactivity"

// `draft`: the images of the composer's draft; `session`: the images sent in the session.
export interface ImageViewerState {
  readonly sessionId: string
  readonly images: "session" | "draft"
  readonly imageId: string
}

export const imageViewerAtom = Atom.make<ImageViewerState | null>(null).pipe(Atom.keepAlive)

// The image whose thumbnail or marker is under the pointer; its other appearances light up.
export const hoveredImageAtom = Atom.make<string | null>(null).pipe(Atom.keepAlive)
