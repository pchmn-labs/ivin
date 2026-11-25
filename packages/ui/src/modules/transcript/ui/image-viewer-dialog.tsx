import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import { useAtom, useAtomValue } from "@effect/atom-react"
import { Option } from "effect"
import { AsyncResult } from "effect/reactivity"
import { Fragment, useEffect, useRef } from "react"
import { IconButton } from "../../../core/components/button/button.tsx"
import { draftOf } from "../../session/atoms/draft.ts"
import { draftImages } from "../../session/rules/draft.ts"
import { type ImageViewerState, imageViewerAtom } from "../atoms/image-viewer.ts"
import { sessionImagesOf } from "../atoms/list-images.ts"
import { imageSrc } from "../atoms/sent-images.ts"
import { imageDataUrl } from "../rules/image-url.ts"
import { withoutImageMarkers } from "../rules/message-parts.ts"
import { ImageThumbnail } from "./image-thumbnail.tsx"
import "./image-viewer-dialog.css"

interface Entry {
  readonly id: string
  readonly number: number
  // Images that share a group were sent in the same message.
  readonly group: string
  readonly caption: string
  readonly src: string
}

const quote = (text: string) =>
  `From your message: “${withoutImageMarkers(text).replace(/\s+/g, " ").trim()}”`

function useEntries({ sessionId, images }: ImageViewerState): ReadonlyArray<Entry> {
  const draft = useAtomValue(draftOf(sessionId))
  const sent = useAtomValue(sessionImagesOf(sessionId))
  if (images === "draft") {
    return draftImages(draft).map((image) => ({
      id: image.id,
      number: image.number,
      group: "draft",
      caption: `${image.name} · Not sent yet`,
      src: imageDataUrl(image),
    }))
  }
  return Option.getOrElse(AsyncResult.value(sent), () => []).map((image) => ({
    id: image.id,
    number: image.number,
    group: image.messageId,
    caption: quote(image.messageText),
    src: imageSrc(sessionId, image),
  }))
}

function Viewer({ state, onStep }: { state: ImageViewerState; onStep: (id: string) => void }) {
  const entries = useEntries(state)
  const index = entries.findIndex((entry) => entry.id === state.imageId)
  const current = entries[index]
  const strip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    strip.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [state.imageId])

  const step = (by: number) => {
    const next = entries[index + by]
    if (next) onStep(next.id)
  }
  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") stepRef.current(-1)
      else if (event.key === "ArrowRight") stepRef.current(1)
      else return
      event.preventDefault()
    }
    // In the capture phase: the dialog's popup keeps key events from bubbling to the document.
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [])

  return (
    <>
      <div className="iv-image-viewer__head">
        <BaseDialog.Title className="iv-image-viewer__title">
          {current ? `Image #${current.number} · ${index + 1} of ${entries.length}` : "Images"}
        </BaseDialog.Title>
        <span className="iv-image-viewer__caption">{current?.caption}</span>
        <BaseDialog.Close render={<IconButton icon="x" label="Close" variant="ghost" />} />
      </div>
      <div className="iv-image-viewer__stage">
        {current && (
          <img key={current.id} className="iv-image-viewer__image" src={current.src} alt="" />
        )}
        <span className="iv-image-viewer__step" data-side="previous">
          <IconButton
            icon="arrow-left"
            label="Previous image"
            variant="ghost"
            disabled={index <= 0}
            onClick={() => step(-1)}
          />
        </span>
        <span className="iv-image-viewer__step" data-side="next">
          <IconButton
            icon="arrow-right"
            label="Next image"
            variant="ghost"
            disabled={index < 0 || index >= entries.length - 1}
            onClick={() => step(1)}
          />
        </span>
      </div>
      <div className="iv-image-viewer__strip" ref={strip}>
        {entries.map((entry, i) => (
          <Fragment key={entry.id}>
            {i > 0 && entries[i - 1]?.group !== entry.group && (
              <span className="iv-image-viewer__separator" />
            )}
            <ImageThumbnail
              imageId={entry.id}
              number={entry.number}
              size="sm"
              current={entry.id === state.imageId}
              lazy
              src={entry.src}
              onOpen={() => onStep(entry.id)}
            />
          </Fragment>
        ))}
      </div>
    </>
  )
}

// Rendered by each session view; it opens for that session only.
export default function ImageViewerDialog({ sessionId }: { sessionId: string }) {
  const [state, setState] = useAtom(imageViewerAtom)
  const open = state?.sessionId === sessionId
  const opener = useRef<{ imageId: string; element: HTMLElement | null } | null>(null)
  const focusOnClose = useRef<HTMLElement | null>(null)
  if (!open) opener.current = null
  else if (opener.current === null) {
    const focused = document.activeElement
    opener.current = {
      imageId: state.imageId,
      element: focused instanceof HTMLElement ? focused : null,
    }
  }

  // Back to what opened the view, or to the thumbnail of the image it closes on.
  useEffect(() => {
    if (!open || !opener.current) return
    const list = state.images === "draft" ? ".iv-draft-images" : ".iv-message-images"
    focusOnClose.current =
      state.imageId === opener.current.imageId
        ? opener.current.element
        : (document.querySelector<HTMLElement>(`${list} [data-image-id="${state.imageId}"]`) ??
          opener.current.element)
  })

  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => !next && setState(null)}>
      <BaseDialog.Portal>
        <BaseDialog.Popup className="iv-image-viewer" aria-label="Images" finalFocus={focusOnClose}>
          {open && state && (
            <Viewer state={state} onStep={(imageId) => setState({ ...state, imageId })} />
          )}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}
