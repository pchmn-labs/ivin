import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { DraftImage, MessageFieldProps } from "@ivin/plugin-api/ui"
import { useImperativeHandle, useRef, useState } from "react"
import { hoveredImageAtom, imageViewerAtom } from "../../transcript/atoms/image-viewer.ts"
import { imageDataUrl } from "../../transcript/rules/image-url.ts"
import { ImagePreview } from "../../transcript/ui/image-preview.tsx"
import { readImageFile } from "../adapters/read-image-file.ts"
import { openSessionsAtom } from "../atoms/open-sessions.ts"
import { draftImages, nextImageNumber } from "../rules/draft.ts"
import { HARNESSES } from "../rules/harnesses.ts"
import { type ImageRefusal, imageRefusal, refusalMessage } from "../rules/image-refusal.ts"
import { DraftImages } from "./draft-images.tsx"
import { type MessageEditorHandle, MessageEditor, carriesFiles } from "./message-editor.tsx"
import "./message-field.css"

export function MessageField({
  ref,
  sessionId,
  draft,
  onDraftChange,
  onRefusal,
  label,
  placeholder,
  footer,
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
    const contents = await Promise.all(accepted.map(readImageFile))
    let number = nextImageNumber(session?.lastImageNumber ?? 0, draft)
    const added: Array<DraftImage> = accepted.map((file, i) => ({
      id: crypto.randomUUID(),
      number: number++,
      mediaType: file.type as DraftImage["mediaType"],
      base64: contents[i] ?? "",
      name: file.name || "Pasted image",
    }))
    onDraftChange((current) => ({ ...current, images: [...current.images, ...added] }))
    editor.current?.insertImages(added, at)
  }

  const openDraftImage = (imageId: string) => openViewer({ sessionId, images: "draft", imageId })

  return (
    <div
      ref={surface}
      className="iv-message-field"
      data-dragging={dragging > 0 || undefined}
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
