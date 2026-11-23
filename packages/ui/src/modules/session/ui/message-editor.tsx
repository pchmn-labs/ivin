import { type Ref, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react"
import { imageDataUrl } from "../../transcript/rules/image-url.ts"
import { imageMarker, messageParts } from "../../transcript/rules/message-parts.ts"
import type { DraftImage } from "@ivin/plugin-api/ui"
import "../../transcript/ui/image-marker.css"
import "./message-editor.css"

export interface MessageEditorHandle {
  // At `at` when it is still in the field, else at the caret, else at the end.
  readonly insertImages: (images: ReadonlyArray<DraftImage>, at: Range | null) => void
  readonly removeImage: (number: number) => void
  readonly focus: () => void
}

export interface MessageEditorProps {
  readonly ref?: Ref<MessageEditorHandle>
  readonly value: string
  // Every image a marker of `value` may name.
  readonly images: ReadonlyArray<DraftImage>
  readonly label: string
  readonly placeholder: string
  readonly hotImageId: string | null
  readonly onChange: (text: string) => void
  readonly onImageFiles: (files: ReadonlyArray<File>, at: Range | null) => void
  readonly onOpenImage: (imageId: string) => void
  readonly onHoverImage: (imageId: string | null, anchor: HTMLElement | null) => void
}

const markerElement = (image: DraftImage) => {
  const marker = document.createElement("span")
  marker.className = "iv-image-marker"
  marker.contentEditable = "false"
  marker.dataset.imageId = image.id
  marker.dataset.number = String(image.number)
  marker.setAttribute("role", "img")
  marker.setAttribute("aria-label", `Image #${image.number}`)
  const frame = document.createElement("span")
  frame.className = "iv-image-marker__image"
  const picture = document.createElement("img")
  picture.src = imageDataUrl(image)
  picture.alt = ""
  frame.append(picture)
  marker.append(frame, `#${image.number}`)
  return marker
}

export const carriesFiles = (data: DataTransfer) => data.types.includes("Files")

const markerOf = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLElement>(".iv-image-marker") : null

const fill = (field: HTMLElement, text: string, images: ReadonlyArray<DraftImage>) => {
  const content = document.createDocumentFragment()
  for (const part of messageParts(text, images)) {
    if (part.type === "image") {
      content.append(markerElement(part.image))
      continue
    }
    part.text.split("\n").forEach((line, i) => {
      if (i > 0) content.append(document.createElement("br"))
      if (line !== "") content.append(line)
    })
  }
  // A last empty line shows only with a second <br>.
  if (text.endsWith("\n")) content.append(document.createElement("br"))
  field.replaceChildren(content)
}

// Lines typed after Enter come as divs, and the field may end with a <br> that is no line.
const serialize = (node: Node, root: Node): string => {
  let text = ""
  node.childNodes.forEach((child, i) => {
    if (child.nodeType === Node.TEXT_NODE) text += (child.nodeValue ?? "").replace(/ /g, " ")
    else if (child instanceof HTMLElement && child.dataset.number !== undefined)
      text += imageMarker(Number(child.dataset.number))
    else if (child.nodeName === "BR")
      text += node === root && i === node.childNodes.length - 1 ? "" : "\n"
    else if (child.nodeName === "DIV" || child.nodeName === "P")
      text += (text === "" || text.endsWith("\n") ? "" : "\n") + serialize(child, root)
    else text += serialize(child, root)
  })
  return text
}

const charAround = (range: Range, side: "before" | "after") => {
  const node = side === "before" ? range.startContainer : range.endContainer
  const offset = side === "before" ? range.startOffset : range.endOffset
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue ?? ""
    return side === "before" ? text.slice(offset - 1, offset) : text.slice(offset, offset + 1)
  }
  const neighbour = node.childNodes[side === "before" ? offset - 1 : offset]
  if (!neighbour) return ""
  if (neighbour.nodeName === "BR") return "\n"
  const text = neighbour.textContent ?? ""
  return side === "before" ? text.slice(-1) : text.slice(0, 1)
}

const select = (range: Range) => {
  const selection = getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

export function MessageEditor({
  ref,
  value,
  images,
  label,
  placeholder,
  hotImageId,
  onChange,
  onImageFiles,
  onOpenImage,
  onHoverImage,
}: MessageEditorProps) {
  const field = useRef<HTMLDivElement>(null)
  // What the field holds, so a value it emitted itself does not redraw it under the caret.
  const shown = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (!field.current || value === shown.current) return
    fill(field.current, value, images)
    shown.current = value
  }, [value, images])

  useEffect(() => {
    field.current?.querySelectorAll<HTMLElement>(".iv-image-marker").forEach((marker) => {
      marker.toggleAttribute("data-hot", marker.dataset.imageId === hotImageId)
    })
  }, [hotImageId, value])

  const emit = () => {
    if (!field.current) return
    const text = serialize(field.current, field.current)
    shown.current = text
    onChange(text)
  }

  const caret = (): Range | null => {
    const selection = getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    return range && field.current?.contains(range.startContainer) ? range.cloneRange() : null
  }

  useImperativeHandle(ref, () => ({
    insertImages: (added, at) => {
      const element = field.current
      if (!element || added.length === 0) return
      element.focus()
      const range =
        (at && element.contains(at.startContainer) ? at : null) ??
        caret() ??
        (() => {
          const end = document.createRange()
          end.selectNodeContents(element)
          end.collapse(false)
          return end
        })()
      select(range)
      const lead = /^$|\s/.test(charAround(range, "before")) ? "" : " "
      const trail = /^[\s ]/.test(charAround(range, "after")) ? "" : "&nbsp;"
      const markers = added.map((image) => {
        const marker = markerElement(image)
        marker.dataset.inserted = ""
        return marker.outerHTML
      })
      // execCommand keeps the insertion on the field's undo stack.
      document.execCommand("insertHTML", false, lead + markers.join(" ") + trail)
      // Chrome leaves the caret inside the text after a non-editable element.
      const inserted = [...element.querySelectorAll<HTMLElement>("[data-inserted]")]
      inserted.forEach((marker) => delete marker.dataset.inserted)
      const last = inserted.at(-1)
      if (last) {
        const after = document.createRange()
        const next = last.nextSibling
        if (next?.nodeType === Node.TEXT_NODE && /^[\s ]/.test(next.nodeValue ?? ""))
          after.setStart(next, 1)
        else after.setStartAfter(last)
        after.collapse(true)
        select(after)
      }
      emit()
    },
    removeImage: (number) => {
      const element = field.current
      if (!element) return
      element.focus()
      element.querySelectorAll(`.iv-image-marker[data-number="${number}"]`).forEach((marker) => {
        const range = document.createRange()
        range.selectNode(marker)
        const next = marker.nextSibling
        if (next?.nodeType === Node.TEXT_NODE && /^[  ]/.test(next.nodeValue ?? ""))
          range.setEnd(next, 1)
        select(range)
        document.execCommand("delete")
      })
      emit()
    },
    focus: () => {
      const element = field.current
      if (!element) return
      element.focus()
      // An inert field refuses the focus; moving the selection would then drop the user's.
      if (document.activeElement !== element) return
      const end = document.createRange()
      end.selectNodeContents(element)
      end.collapse(false)
      select(end)
    },
  }))

  useEffect(() => {
    const element = field.current
    if (!element) return
    // Enter that no keybinding took starts a new line, never a paragraph.
    const onBeforeInput = (event: InputEvent) => {
      if (event.inputType !== "insertParagraph") return
      event.preventDefault()
      document.execCommand("insertLineBreak")
    }
    element.addEventListener("beforeinput", onBeforeInput)
    return () => element.removeEventListener("beforeinput", onBeforeInput)
  }, [])

  return (
    <div className="iv-message-editor">
      {value === "" && (
        <span className="iv-message-editor__placeholder" aria-hidden="true">
          {placeholder}
        </span>
      )}
      <div
        ref={field}
        className="iv-message-editor__field"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        aria-placeholder={placeholder}
        onInput={emit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.shiftKey && !event.metaKey && !event.ctrlKey) {
            event.preventDefault()
            document.execCommand("insertLineBreak")
          }
        }}
        onPaste={(event) => {
          event.preventDefault()
          const files = [...event.clipboardData.files]
          if (files.length > 0) onImageFiles(files, caret())
          else document.execCommand("insertText", false, event.clipboardData.getData("text/plain"))
        }}
        onDragOver={(event) => {
          if (carriesFiles(event.dataTransfer)) event.preventDefault()
        }}
        onDrop={(event) => {
          if (!carriesFiles(event.dataTransfer)) return
          event.preventDefault()
          event.stopPropagation()
          // The image lands where the caret would go under the pointer.
          const at = document.caretRangeFromPoint?.(event.clientX, event.clientY) ?? null
          onImageFiles([...event.dataTransfer.files], at)
        }}
        onClick={(event) => {
          const marker = markerOf(event.target)
          if (marker?.dataset.imageId) onOpenImage(marker.dataset.imageId)
        }}
        onMouseOver={(event) => {
          const marker = markerOf(event.target)
          onHoverImage(marker?.dataset.imageId ?? null, marker)
        }}
        onMouseLeave={() => onHoverImage(null, null)}
      />
    </div>
  )
}
