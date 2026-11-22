import {
  type EditorState,
  type Extension,
  type Range,
  RangeSet,
  StateField,
} from "@codemirror/state"
import {
  Decoration,
  type DecorationSet,
  EditorView,
  gutter,
  GutterMarker,
  gutterLineClass,
  WidgetType,
} from "@codemirror/view"

export interface DiffRow {
  readonly kind: "context" | "added" | "deleted"
  readonly oldLine: number | null
  readonly newLine: number | null
  readonly changed: readonly [number, number] | null
}

// `rows[i]` describes the document's line i + 1; a hunk's header shows above its `start` row.
export interface DiffLayout {
  readonly rows: ReadonlyArray<DiffRow>
  readonly hunks: ReadonlyArray<{ readonly start: number; readonly header: string }>
}

class TextMarker extends GutterMarker {
  constructor(readonly text: string) {
    super()
  }
  override eq(other: GutterMarker) {
    return other instanceof TextMarker && other.text === this.text
  }
  override toDOM() {
    return document.createTextNode(this.text)
  }
}

class RowClass extends GutterMarker {
  constructor(override readonly elementClass: string) {
    super()
  }
}

class HunkHeader extends WidgetType {
  constructor(readonly header: string) {
    super()
  }
  override eq(other: HunkHeader) {
    return other.header === this.header
  }
  override get estimatedHeight() {
    return 28
  }
  override toDOM() {
    const element = document.createElement("div")
    element.className = "iv-diff-hunk"
    element.textContent = this.header
    return element
  }
}

const SIGNS = { context: "", added: "+", deleted: "−" } as const

const rowAt = (rows: ReadonlyArray<DiffRow>, state: EditorState, from: number) =>
  rows[state.doc.lineAt(from).number - 1]

const numberGutter = (rows: ReadonlyArray<DiffRow>, side: "oldLine" | "newLine") => {
  const widest = rows.reduce((max, row) => Math.max(max, row[side] ?? 0), 0)
  return gutter({
    class: `iv-diff-numbers iv-diff-numbers--${side === "oldLine" ? "old" : "new"}`,
    lineMarker: (view, line) => {
      const number = rowAt(rows, view.state, line.from)?.[side]
      return number == null ? null : new TextMarker(String(number))
    },
    initialSpacer: () => new TextMarker(String(widest)),
  })
}

const decorationsOf = (state: EditorState, { rows, hunks }: DiffLayout): DecorationSet => {
  const ranges: Range<Decoration>[] = []
  const lines = state.doc.lines
  for (const { start, header } of hunks)
    if (start < lines)
      ranges.push(
        Decoration.widget({ widget: new HunkHeader(header), block: true, side: -1 }).range(
          state.doc.line(start + 1).from,
        ),
      )
  rows.forEach((row, index) => {
    if (row.kind === "context" || index >= lines) return
    const line = state.doc.line(index + 1)
    ranges.push(Decoration.line({ class: `iv-diff-line--${row.kind}` }).range(line.from))
    const [from, to] = row.changed ?? [0, 0]
    if (to > from && line.from + to <= line.to)
      ranges.push(
        Decoration.mark({ class: `iv-diff-change--${row.kind}` }).range(
          line.from + from,
          line.from + to,
        ),
      )
  })
  return Decoration.set(ranges, true)
}

const rowClassesOf = (state: EditorState, rows: ReadonlyArray<DiffRow>) => {
  const ranges: Range<GutterMarker>[] = []
  const added = new RowClass("iv-diff-line--added")
  const deleted = new RowClass("iv-diff-line--deleted")
  rows.forEach((row, index) => {
    if (row.kind === "context" || index >= state.doc.lines) return
    ranges.push((row.kind === "added" ? added : deleted).range(state.doc.line(index + 1).from))
  })
  return RangeSet.of(ranges, true)
}

// Read-only: the decorations are built once from the document they were made for.
export const diffExtensions = (layout: DiffLayout): Extension => {
  const decorations = StateField.define<DecorationSet>({
    create: (state) => decorationsOf(state, layout),
    update: (value, transaction) => value.map(transaction.changes),
    provide: (field) => EditorView.decorations.from(field),
  })
  const rowClasses = StateField.define<RangeSet<GutterMarker>>({
    create: (state) => rowClassesOf(state, layout.rows),
    update: (value, transaction) => value.map(transaction.changes),
    provide: (field) => gutterLineClass.from(field),
  })
  return [
    decorations,
    rowClasses,
    numberGutter(layout.rows, "oldLine"),
    numberGutter(layout.rows, "newLine"),
    gutter({
      class: "iv-diff-signs",
      lineMarker: (view, line) => {
        const row = rowAt(layout.rows, view.state, line.from)
        return row === undefined || row.kind === "context" ? null : new TextMarker(SIGNS[row.kind])
      },
    }),
  ]
}
