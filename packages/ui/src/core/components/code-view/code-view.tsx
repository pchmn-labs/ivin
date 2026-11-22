import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { bracketMatching, indentOnInput, syntaxHighlighting } from "@codemirror/language"
import { gotoLine, highlightSelectionMatches, search, searchKeymap } from "@codemirror/search"
import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
  type Extension,
  Transaction,
} from "@codemirror/state"
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from "@codemirror/view"
import { useEffect, useRef } from "react"
import { type DiffLayout, diffExtensions } from "./diff.ts"
import { highlightStyle } from "./highlight-style.ts"
import { languageNameOf } from "./language-name.ts"
import { loadLanguage } from "./languages.ts"
import "./code-view.css"

// Prose keeps a paragraph on one line, so only Markdown wraps; code keeps its layout.
const wrappingOf = (fileName: string) =>
  languageNameOf(fileName) === "markdown" ? EditorView.lineWrapping : []

// Like VS Code, a file is written back with the line break most of its lines end with.
const lineBreakOf = (text: string) => {
  const crlf = text.match(/\r\n/g)?.length ?? 0
  const lf = (text.match(/\n/g)?.length ?? 0) - crlf
  return crlf > lf ? "\r\n" : "\n"
}

const textOf = (state: EditorState, lineBreak: string) =>
  state.doc.sliceString(0, state.doc.length, lineBreak)

const noExtensions: Extension = []

const replacedText = Annotation.define<true>()

const editing = (onChange: () => void): Extension => [
  history(),
  indentOnInput(),
  bracketMatching(),
  highlightSelectionMatches(),
  search({ top: true }),
  EditorState.allowMultipleSelections.of(true),
  EditorView.clickAddsSelectionRange.of((event) => event.altKey),
  keymap.of([
    { key: "Ctrl-g", run: gotoLine, preventDefault: true },
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    indentWithTab,
    // An Escape the editor has no use for would reach the window and stop the agent.
    { key: "Escape", run: () => true },
  ]),
  EditorView.updateListener.of((update) => {
    const edited = update.transactions.some(
      (transaction) => transaction.docChanged && !transaction.annotation(replacedText),
    )
    if (edited) onChange()
  }),
]

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
  // Makes the text editable, and receives it after each edit.
  readonly onChange?: (text: string) => void
  readonly extensions?: Extension
  // Shows `text` as a diff: each side's line numbers, the added and deleted lines, the hunks.
  readonly diff?: DiffLayout
  readonly "data-testid"?: string
}

const gutterOf = (diff: DiffLayout | undefined): Extension =>
  diff === undefined ? [lineNumbers(), highlightActiveLineGutter()] : diffExtensions(diff)

export function CodeView({
  text,
  fileName,
  scrollTop = 0,
  onScroll,
  shownLines,
  onChange,
  extensions = noExtensions,
  diff,
  "data-testid": testId,
}: CodeViewProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const language = useRef(new Compartment())
  const wrapping = useRef(new Compartment())
  const added = useRef(new Compartment())
  const gutters = useRef(new Compartment())
  const shownDiff = useRef(diff)
  const lineBreak = useRef(lineBreakOf(text))
  const latestOnScroll = useRef(onScroll)
  const latestOnChange = useRef(onChange)
  useEffect(() => {
    latestOnScroll.current = onScroll
    latestOnChange.current = onChange
  })
  const editable = onChange !== undefined

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: text,
        extensions: [
          gutters.current.of(gutterOf(diff)),
          highlightSpecialChars(),
          drawSelection(),
          highlightActiveLine(),
          syntaxHighlighting(highlightStyle),
          editable
            ? editing(() => latestOnChange.current?.(textOf(editor.state, lineBreak.current)))
            : EditorState.readOnly.of(true),
          EditorView.contentAttributes.of({ "aria-label": fileName }),
          language.current.of([]),
          wrapping.current.of(wrappingOf(fileName)),
          added.current.of(extensions),
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
    lineBreak.current = lineBreakOf(text)
    const current = textOf(editor.state, lineBreak.current)
    // A diff's decorations are built for its text, so both change in one transaction.
    const newDiff = diff !== shownDiff.current
    shownDiff.current = diff
    // An edit the view reported comes back as `text`; only another text replaces the document.
    if (current !== text || newDiff) {
      editor.dispatch({
        ...(current !== text && {
          changes: { from: 0, to: editor.state.doc.length, insert: text },
        }),
        ...(newDiff && { effects: gutters.current.reconfigure(gutterOf(diff)) }),
        annotations: [replacedText.of(true), Transaction.addToHistory.of(false)],
      })
    }
  }, [text, diff])

  useEffect(() => {
    view.current!.dispatch({ effects: added.current.reconfigure(extensions) })
  }, [extensions])

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
