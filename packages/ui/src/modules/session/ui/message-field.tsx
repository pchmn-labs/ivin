import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { DraftImage, MessageFieldProps } from "@ivin/plugin-api/ui"
import {
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import {
  CompletionSheet,
  completionOptionId,
} from "../../../core/components/completion-sheet/completion-sheet.tsx"
import { hoveredImageAtom, imageViewerAtom } from "../../transcript/atoms/image-viewer.ts"
import { imageMarker } from "../../transcript/rules/message-parts.ts"
import { imageDataUrl } from "../../transcript/rules/image-url.ts"
import { ImagePreview } from "../../transcript/ui/image-preview.tsx"
import { readImageFile } from "../adapters/read-image-file.ts"
import { openSessionsAtom } from "../atoms/open-sessions.ts"
import { completionWord, pickedText, wordKey } from "../rules/completion-word.ts"
import { draftImages, nextImageNumber } from "../rules/draft.ts"
import { HARNESSES } from "../rules/harnesses.ts"
import { type ImageRefusal, imageRefusal, refusalMessage } from "../rules/image-refusal.ts"
import { DraftImages } from "./draft-images.tsx"
import { type MessageEditorHandle, MessageEditor, carriesFiles } from "./message-editor.tsx"
import "./message-field.css"

// Images still being read, per session; module-level so a read outlives the composer it began in.
const readsInFlight = new Map<string, { count: number; highest: number }>()

const withMarkers = (text: string, images: ReadonlyArray<DraftImage>) => {
  const markers = images.map((image) => imageMarker(image.number)).join(" ")
  return text === "" || /\s$/.test(text) ? text + markers : `${text} ${markers}`
}

export function MessageField({
  ref,
  sessionId,
  draft,
  onDraftChange,
  onRefusal,
  label,
  placeholder,
  footer,
  completion,
}: MessageFieldProps) {
  const surface = useRef<HTMLDivElement>(null)
  const editor = useRef<MessageEditorHandle>(null)
  const [dragging, setDragging] = useState(0)
  const [preview, setPreview] = useState<{ image: DraftImage; anchor: HTMLElement } | null>(null)
  const [hoveredImage, setHoveredImage] = useAtom(hoveredImageAtom)
  const openViewer = useAtomSet(imageViewerAtom)
  const session = useAtomValue(openSessionsAtom).find((s) => s.id === sessionId)
  const harness = session && HARNESSES[session.harness]
  const maxImageBytes = harness?.maxImageBytes ?? 0

  const listId = useId()
  const [caret, setCaret] = useState<number | null>(null)
  // The word Escape closed the sheet on, until the word changes.
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const word = completion
    ? completionWord(draft.text, caret, completion.trigger, completion.atStart ?? false)
    : null
  const shownWord = word && wordKey(word.start, draft.text.slice(word.start, word.end))
  const open = completion !== undefined && word !== null && shownWord !== dismissed
  const items = open ? completion.items(word.query) : []
  const message =
    items.length > 0 ? null : (completion?.message ?? completion?.empty(word?.query ?? ""))
  const [shownQuery, setShownQuery] = useState<string | null>(null)
  const query = open ? word.query : null
  if (query !== shownQuery) {
    setShownQuery(query)
    setActive(0)
  }
  const highlighted = Math.min(active, items.length - 1)

  // The sheet docks above the field and must not cover the tab bar when the field sits high.
  useLayoutEffect(() => {
    const element = surface.current
    if (!open || !element) return
    const measure = () => {
      const top = element.closest(".iv-session-view")?.getBoundingClientRect().top ?? 0
      const room = Math.max(0, element.getBoundingClientRect().top - top - 8)
      element.style.setProperty("--iv-completion-room", `${room}px`)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [open])

  const opened = useEffectEvent(() => completion?.onOpen?.())
  useEffect(() => {
    if (open) opened()
  }, [open])

  const pick = (label: string) => {
    if (!completion || !word || caret === null) return
    const text = pickedText(word, completion.trigger, label, draft.text)
    setDismissed(wordKey(word.start, `${completion.trigger}${label}`))
    editor.current?.replaceAroundCaret(caret - word.start, word.end - caret, text)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open || event.nativeEvent.isComposing) return
    const plain = !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey
    if (event.key === "Escape") {
      event.preventDefault()
      setDismissed(shownWord)
      return
    }
    const current = items[highlighted]
    if (!plain || current === undefined) return
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const step = event.key === "ArrowDown" ? 1 : -1
      setActive(Math.max(0, Math.min(items.length - 1, highlighted + step)))
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault()
      pick(current.label)
    }
  }

  useImperativeHandle(ref, () => ({
    focus: () => editor.current?.focus(),
    holds: (target) =>
      target instanceof Element &&
      surface.current?.contains(target) === true &&
      target.closest(".iv-message-editor") !== null,
  }))

  const addImageFiles = async (files: ReadonlyArray<File>, at: Range | null) => {
    const refused: Array<ImageRefusal> = []
    const accepted: Array<File> = []
    for (const file of files) {
      const problem = imageRefusal(file, maxImageBytes)
      if (problem) refused.push(problem)
      else accepted.push(file)
    }
    onRefusal(
      refused.length === 0
        ? null
        : refusalMessage(refused, harness?.name ?? "the agent", maxImageBytes),
    )
    if (accepted.length === 0) return
    const reading = readsInFlight.get(sessionId) ?? { count: 0, highest: 0 }
    let number = nextImageNumber(Math.max(session?.lastImageNumber ?? 0, reading.highest), draft)
    readsInFlight.set(sessionId, {
      count: reading.count + 1,
      highest: number + accepted.length - 1,
    })
    const contents = await Promise.all(accepted.map(readImageFile)).finally(() => {
      const left = readsInFlight.get(sessionId)!
      if (left.count === 1) readsInFlight.delete(sessionId)
      else readsInFlight.set(sessionId, { ...left, count: left.count - 1 })
    })
    const added: Array<DraftImage> = accepted.map((file, i) => ({
      id: crypto.randomUUID(),
      number: number++,
      mediaType: file.type as DraftImage["mediaType"],
      base64: contents[i] ?? "",
      name: file.name || "Pasted image",
    }))
    const handle = editor.current
    onDraftChange((current) => ({
      text: handle ? current.text : withMarkers(current.text, added),
      images: [...current.images, ...added],
    }))
    handle?.insertImages(added, at)
  }

  const openDraftImage = (imageId: string) => openViewer({ sessionId, images: "draft", imageId })

  return (
    <div
      ref={surface}
      className="iv-message-field"
      data-dragging={dragging > 0 || undefined}
      data-completion={open || undefined}
      onDragEnter={(event) => {
        if (carriesFiles(event.dataTransfer)) setDragging((n) => n + 1)
      }}
      onDragLeave={(event) => {
        if (carriesFiles(event.dataTransfer)) setDragging((n) => Math.max(0, n - 1))
      }}
      onDragOver={(event) => {
        if (carriesFiles(event.dataTransfer)) event.preventDefault()
      }}
      onDropCapture={() => setDragging(0)}
      onDrop={(event) => {
        if (!carriesFiles(event.dataTransfer)) return
        event.preventDefault()
        void addImageFiles([...event.dataTransfer.files], null)
      }}
    >
      {completion && (
        <CompletionSheet
          open={open}
          listId={listId}
          trigger={completion.trigger}
          title={completion.title}
          items={items}
          active={highlighted}
          message={message}
          onHover={setActive}
          onPick={(item) => pick(item.label)}
        />
      )}
      <DraftImages
        images={draftImages(draft)}
        onOpen={openDraftImage}
        onRemove={(number) => {
          onRefusal(null)
          editor.current?.removeImage(number)
        }}
      />
      <MessageEditor
        ref={editor}
        label={label}
        placeholder={placeholder}
        value={draft.text}
        images={draft.images}
        hotImageId={hoveredImage}
        onChange={(next) => onDraftChange((current) => ({ ...current, text: next }))}
        onImageFiles={(files, at) => void addImageFiles(files, at)}
        onOpenImage={openDraftImage}
        onCaret={setCaret}
        onKeyDown={onKeyDown}
        combobox={
          open
            ? {
                listId,
                activeId: items.length > 0 ? completionOptionId(listId, highlighted) : null,
              }
            : null
        }
        onHoverImage={(imageId, anchor) => {
          setHoveredImage(imageId)
          const image = draft.images.find((candidate) => candidate.id === imageId)
          setPreview(image && anchor ? { image, anchor } : null)
        }}
      />
      {preview && (
        <ImagePreview
          anchor={preview.anchor}
          number={preview.image.number}
          src={imageDataUrl(preview.image)}
        />
      )}
      {footer}
    </div>
  )
}
