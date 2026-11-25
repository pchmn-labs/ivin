import { Fragment, useEffect, useRef, useState, type ReactNode } from "react"
import { IconButton } from "../../src/core/components/button/button.tsx"
import "../../src/modules/transcript/ui/image-marker.css"
import "../../src/modules/transcript/ui/image-thumbnail.css"
import "../../src/modules/transcript/ui/image-viewer.css"
import "../../src/modules/transcript/ui/message-images.css"
import { screenshot } from "./fake.ts"
import { BrokenImageIcon } from "./image-icon.tsx"

interface Img {
  readonly id: string
  readonly number: number
  readonly src: string
  readonly deleted: boolean
  readonly messageId: string
}

interface Message {
  readonly id: string
  readonly text: string
  readonly images: ReadonlyArray<Img>
}

const MESSAGES: ReadonlyArray<Message> = [
  {
    id: "m1",
    text: "The tab bar overflows on a narrow window, see [Image #1]. In [Image #2] the close buttons overlap the titles.",
    images: [
      { id: "i1", number: 1, src: screenshot(210, 0), deleted: true, messageId: "m1" },
      { id: "i2", number: 2, src: screenshot(210, 3), deleted: true, messageId: "m1" },
    ],
  },
  {
    id: "m2",
    text: "Better. Same bug as [Image #1] in the Files panel though: [Image #3]",
    images: [{ id: "i3", number: 3, src: screenshot(150, 1), deleted: false, messageId: "m2" }],
  },
]

const ALL = MESSAGES.flatMap((message) => message.images)
const quoteOf = (messageId: string) =>
  `From your message: “${MESSAGES.find((m) => m.id === messageId)!
    .text.replace(/\s*\[Image #\d+\]/g, "")
    .trim()}”`

type Treatment = "placeholder" | "folded"

function Thumbnail({
  image,
  size,
  current,
  onOpen,
}: {
  image: Img
  size: "sm" | "lg"
  current?: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className="iv-image-thumbnail"
      data-size={size}
      data-deleted={image.deleted || undefined}
      aria-current={current}
      aria-label={image.deleted ? `Image #${image.number}, deleted` : `View image #${image.number}`}
      onClick={onOpen}
    >
      {image.deleted ? (
        <span className="proto-deleted-tile">
          <BrokenImageIcon size={size === "sm" ? 14 : 18} />
          {size === "lg" && <span>Deleted</span>}
        </span>
      ) : (
        <img src={image.src} alt="" />
      )}
      {size === "lg" && <span className="iv-image-thumbnail__number">#{image.number}</span>}
    </button>
  )
}

function Marker({
  image,
  treatment,
  onOpen,
}: {
  image: Img
  treatment: Treatment
  onOpen: () => void
}) {
  if (image.deleted && treatment === "folded") {
    return (
      <span className="proto-marker-gone" title={`Image #${image.number} was deleted`}>
        #{image.number}
      </span>
    )
  }
  return (
    <button
      type="button"
      className="iv-image-marker"
      data-deleted={image.deleted || undefined}
      aria-label={image.deleted ? `Image #${image.number}, deleted` : `View image #${image.number}`}
      onClick={onOpen}
    >
      <span className="iv-image-marker__image">
        {image.deleted ? <BrokenImageIcon size={12} /> : <img src={image.src} alt="" />}
      </span>
      #{image.number}
    </button>
  )
}

function MessageText({
  message,
  treatment,
  onOpen,
}: {
  message: Message
  treatment: Treatment
  onOpen: (id: string) => void
}) {
  const parts = message.text.split(/(\[Image #\d+\])/)
  return (
    <p className="iv-message-text">
      {parts.map((part, i) => {
        const match = /^\[Image #(\d+)\]$/.exec(part)
        const image = match && ALL.find((img) => img.number === Number(match[1]))
        return image ? (
          <Marker key={i} image={image} treatment={treatment} onOpen={() => onOpen(image.id)} />
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      })}
    </p>
  )
}

function Bubble({
  message,
  treatment,
  onOpen,
}: {
  message: Message
  treatment: Treatment
  onOpen: (id: string) => void
}) {
  const shown = treatment === "folded" ? message.images.filter((i) => !i.deleted) : message.images
  const gone = message.images.length - shown.length
  return (
    <div className="proto-bubble">
      {shown.length > 0 && (
        <div className="iv-message-images">
          {shown.map((image) => (
            <Thumbnail key={image.id} image={image} size="lg" onOpen={() => onOpen(image.id)} />
          ))}
        </div>
      )}
      {gone > 0 && (
        <div className="proto-gone-line">
          <BrokenImageIcon size={12} />
          {gone === 1 ? "1 image deleted" : `${gone} images deleted`}
        </div>
      )}
      <MessageText message={message} treatment={treatment} onOpen={onOpen} />
    </div>
  )
}

function Viewer({
  treatment,
  imageId,
  onStep,
  onClose,
}: {
  treatment: Treatment
  imageId: string
  onStep: (id: string) => void
  onClose: () => void
}) {
  const entries = treatment === "folded" ? ALL.filter((i) => !i.deleted) : ALL
  const index = entries.findIndex((e) => e.id === imageId)
  const current = entries[index]
  const stepRef = useRef((by: number) => {})
  stepRef.current = (by) => {
    const next = entries[index + by]
    if (next) onStep(next.id)
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      else if (event.key === "ArrowLeft") stepRef.current(-1)
      else if (event.key === "ArrowRight") stepRef.current(1)
      else return
      event.preventDefault()
      event.stopPropagation()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [onClose])
  return (
    <div className="iv-image-viewer" role="dialog" aria-label="Images">
      <div className="iv-image-viewer__head">
        <h2 className="iv-image-viewer__title">
          {current ? `Image #${current.number} · ${index + 1} of ${entries.length}` : "Images"}
        </h2>
        <span className="iv-image-viewer__caption">{current && quoteOf(current.messageId)}</span>
        <IconButton icon="x" label="Close" onClick={onClose} />
      </div>
      <div className="iv-image-viewer__stage">
        {current?.deleted ? (
          <div className="proto-viewer-gone">
            <BrokenImageIcon size={32} />
            <span className="proto-viewer-gone-title">Image #{current.number} was deleted</span>
            <span className="proto-viewer-gone-text">
              It was deleted from Settings to free space. The message keeps its text.
            </span>
          </div>
        ) : (
          current && <img className="iv-image-viewer__image" src={current.src} alt="" />
        )}
        <span className="iv-image-viewer__step" data-side="previous">
          <IconButton
            icon="arrow-left"
            label="Previous image"
            disabled={index <= 0}
            onClick={() => stepRef.current(-1)}
          />
        </span>
        <span className="iv-image-viewer__step" data-side="next">
          <IconButton
            icon="arrow-right"
            label="Next image"
            disabled={index >= entries.length - 1}
            onClick={() => stepRef.current(1)}
          />
        </span>
      </div>
      <div className="iv-image-viewer__strip">
        {entries.map((entry, i) => (
          <Fragment key={entry.id}>
            {i > 0 && entries[i - 1]!.messageId !== entry.messageId && (
              <span className="iv-image-viewer__separator" />
            )}
            <Thumbnail
              image={entry}
              size="sm"
              current={entry.id === imageId}
              onOpen={() => onStep(entry.id)}
            />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function Session({ treatment, note }: { treatment: Treatment; note: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="proto-app">
      <div className="proto-main">
        <div className="proto-tabbar">
          <span className="proto-tab" data-selected>
            Fix the tab bar overflow
          </span>
          <span className="proto-tab">Show the release notes</span>
        </div>
        <div className="proto-transcript">
          {MESSAGES.map((message, i) => (
            <Fragment key={message.id}>
              <Bubble message={message} treatment={treatment} onOpen={setOpen} />
              <p className="proto-answer">
                {i === 0
                  ? "The tab bar now scrolls when its tabs do not fit, and each close button sits in its own 16px slot after the title."
                  : "The Files panel's head had the same flex rule. Fixed it the same way."}
              </p>
            </Fragment>
          ))}
          <p className="proto-note">{note}</p>
        </div>
      </div>
      {open !== null && (
        <Viewer
          treatment={treatment}
          imageId={open}
          onStep={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

// Each deleted image keeps its tile and its marker, drawn empty; the full-screen view says so.
export function Placeholder() {
  return (
    <Session
      treatment="placeholder"
      note="Images #1 and #2 were deleted from Settings. Click any thumbnail or marker."
    />
  )
}

// Deleted images leave the message's row for one line; markers turn to plain text; the view skips them.
export function Folded() {
  return (
    <Session
      treatment="folded"
      note="Images #1 and #2 were deleted from Settings. Click #3 to open the full-screen view."
    />
  )
}
