import { syntaxHighlighting } from "@codemirror/language"
import { Compartment, EditorSelection, EditorState } from "@codemirror/state"
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  lineNumbers,
} from "@codemirror/view"
import { useEffect, useRef } from "react"
import { highlightStyle } from "./highlight-style.ts"
import { languageNameOf } from "./language-name.ts"
import { loadLanguage } from "./languages.ts"
import "./code-view.css"

// Prose keeps a paragraph on one line, so only Markdown wraps; code keeps its layout.
const wrappingOf = (fileName: string) =>
  languageNameOf(fileName) === "markdown" ? EditorView.lineWrapping : []

export interface ShownLines {
  readonly start: number
  readonly end: number
  // A new value shows the lines again, even the same ones.
  readonly request: number
}

const showLines = (editor: EditorView, { start, end }: ShownLines) => {
  const { doc } = editor.state
  const from = doc.line(Math.min(Math.max(start, 1), doc.lines)).from
  const to = doc.line(Math.min(Math.max(end, 1), doc.lines)).to
  editor.dispatch({
    selection: EditorSelection.range(from, to),
    effects: EditorView.scrollIntoView(from, { y: "center" }),
  })
}

export interface CodeViewProps {
  readonly text: string
  // Picks the language, and names the view for assistive technology.
  readonly fileName: string
  // Where the view opens scrolled to, in pixels.
  readonly scrollTop?: number
  readonly onScroll?: (scrollTop: number) => void
  // Scrolled to and selected, in place of `scrollTop`.
  readonly shownLines?: ShownLines
  readonly "data-testid"?: string
}

export function CodeView({
  text,
  fileName,
  scrollTop = 0,
  onScroll,
  shownLines,
  "data-testid": testId,
}: CodeViewProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const language = useRef(new Compartment())
  const wrapping = useRef(new Compartment())
  const latestOnScroll = useRef(onScroll)
  useEffect(() => {
    latestOnScroll.current = onScroll
  })

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: text,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          drawSelection(),
          highlightActiveLine(),
          syntaxHighlighting(highlightStyle),
          EditorState.readOnly.of(true),
          EditorView.contentAttributes.of({ "aria-label": fileName }),
          language.current.of([]),
          wrapping.current.of(wrappingOf(fileName)),
        ],
      }),
    })
    view.current = editor
    const scrolled = () => latestOnScroll.current?.(editor.scrollDOM.scrollTop)
    editor.scrollDOM.addEventListener("scroll", scrolled, { passive: true })
    if (shownLines === undefined) {
      editor.requestMeasure({
        read: () => null,
        write: () => {
          editor.scrollDOM.scrollTop = scrollTop
        },
      })
    }
    return () => {
      editor.scrollDOM.removeEventListener("scroll", scrolled)
      editor.destroy()
      view.current = null
    }
    // The text and the language follow in the effects below, without a new view.
  }, [])

  useEffect(() => {
    const editor = view.current!
    const current = editor.state.doc.toString()
    if (current !== text) {
      editor.dispatch({ changes: { from: 0, to: current.length, insert: text } })
    }
  }, [text])

  useEffect(() => {
    if (shownLines) showLines(view.current!, shownLines)
  }, [shownLines?.request])

  useEffect(() => {
    view.current!.dispatch({ effects: wrapping.current.reconfigure(wrappingOf(fileName)) })
    const name = languageNameOf(fileName)
    if (name === null) return
    let cancelled = false
    void loadLanguage[name]().then((extension) => {
      if (!cancelled) view.current?.dispatch({ effects: language.current.reconfigure(extension) })
    })
    return () => {
      cancelled = true
      view.current?.dispatch({ effects: language.current.reconfigure([]) })
    }
  }, [fileName])

  return <div ref={host} className="iv-code-view" data-testid={testId} />
}
