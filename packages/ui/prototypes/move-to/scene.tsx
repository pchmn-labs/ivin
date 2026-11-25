import { Dialog } from "@base-ui/react/dialog"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Icon } from "../../src/core/components/icon/icon.tsx"
import { IconButton } from "../../src/core/components/button/button.tsx"
import "../../src/core/components/sheet-frame/sheet-frame.css"
import "../../src/modules/tab/ui/sub-view-card.css"
import "../../src/modules/tab/ui/tab-view.css"
import "../../src/core/components/dialog/dialog.css"
import "../../src/modules/view/ui/view-dialog.css"
import { PlacementIcon } from "./placement-icon.tsx"

export type Placement = "subView" | "sheet" | "dialog"

export interface View {
  readonly id: string
  readonly kind: "task" | "command" | "file" | "diff"
  readonly title: string
  readonly placements: ReadonlyArray<Placement>
}

export const PLACEMENT_LABEL: Record<Placement, string> = {
  subView: "Beside chat",
  sheet: "Sheet",
  dialog: "Dialog",
}

const TASK: View = {
  id: "task:review",
  kind: "task",
  title: "Review the diff",
  placements: ["sheet", "subView"],
}
const COMMAND: View = {
  id: "task:test",
  kind: "command",
  title: "pnpm test --watch",
  placements: ["sheet", "subView"],
}
const README: View = {
  id: "file:README.md",
  kind: "file",
  title: "README.md",
  placements: ["subView", "dialog"],
}
const DIFF: View = {
  id: "diff:src/app.ts",
  kind: "diff",
  title: "app.ts",
  placements: ["subView"],
}

interface State {
  readonly subViews: ReadonlyArray<View>
  readonly subSelected: string | null
  readonly sheet: ReadonlyArray<View>
  readonly sheetSelected: string | null
  readonly dialog: View | null
}

const initial: State = {
  subViews: [README, DIFF],
  subSelected: README.id,
  sheet: [TASK],
  sheetSelected: TASK.id,
  dialog: null,
}

const without = (views: ReadonlyArray<View>, view: View) => views.filter((v) => v.id !== view.id)
const nextSelected = (views: ReadonlyArray<View>, view: View, selected: string | null) => {
  if (selected !== view.id) return selected
  const index = views.findIndex((v) => v.id === view.id)
  const rest = without(views, view)
  return (rest[index] ?? rest[index - 1])?.id ?? null
}

export const placementOf = (state: State, view: View): Placement | null =>
  state.subViews.some((v) => v.id === view.id)
    ? "subView"
    : state.sheet.some((v) => v.id === view.id)
      ? "sheet"
      : state.dialog?.id === view.id
        ? "dialog"
        : null

const closed = (state: State, view: View): State => ({
  subViews: without(state.subViews, view),
  subSelected: nextSelected(state.subViews, view, state.subSelected),
  sheet: without(state.sheet, view),
  sheetSelected: nextSelected(state.sheet, view, state.sheetSelected),
  dialog: state.dialog?.id === view.id ? null : state.dialog,
})

const opened = (state: State, view: View, where: Placement): State => {
  const at = closed(state, view)
  if (where === "subView")
    return { ...at, subViews: [...at.subViews, view], subSelected: view.id }
  if (where === "sheet") return { ...at, sheet: [...at.sheet, view], sheetSelected: view.id }
  return { ...at, dialog: view }
}

// What each variant draws to move a view; `frame` says which frame it sits in.
export interface MoveProps {
  readonly view: View
  readonly from: Placement
  readonly targets: ReadonlyArray<Placement>
  readonly move: (to: Placement) => void
  readonly close: () => void
  readonly registerOpener: (open: () => void) => void
}

export interface Variant {
  // Drawn at the right of a frame's head, before its own buttons.
  readonly HeadControl?: (props: MoveProps) => ReactNode
  // Wraps a tab, to give it a menu of its own.
  readonly TabWrapper?: (props: MoveProps & { readonly children: ReactNode; readonly selected: boolean }) => ReactNode
  // Replaces the dialog's title.
  readonly DialogTitle?: (props: MoveProps) => ReactNode
  // What the "Move view" key does when the variant has no menu to open.
  readonly onCommand?: (props: MoveProps) => void
  readonly keyHint: string
}

const KIND_ICON = { task: "robot", command: "terminal", file: "file", diff: "diff" } as const

function ViewIcon({ view }: { view: View }) {
  return <Icon name={KIND_ICON[view.kind]} size={14} />
}

export function Scene({ variant }: { variant: Variant }) {
  const [state, setState] = useState(initial)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const openers = useRef(new Map<string, () => void>())
  const pendingFocus = useRef<string | null>(null)

  const propsFor = (view: View): MoveProps => {
    const from = placementOf(state, view) ?? "subView"
    return {
      view,
      from,
      targets: view.placements.filter((p) => p !== from),
      move: (to) => {
        pendingFocus.current = view.id
        setState((s) => opened(s, view, to))
      },
      close: () => setState((s) => closed(s, view)),
      registerOpener: (open) => openers.current.set(`${view.id}@${from}`, open),
    }
  }

  // The moved view takes the focus: its tab, or the dialog's first control.
  useEffect(() => {
    const id = pendingFocus.current
    if (id === null) return
    pendingFocus.current = null
    requestAnimationFrame(() => {
      const target =
        document.querySelector<HTMLElement>(`[data-view-tab="${CSS.escape(id)}"]`) ??
        document.querySelector<HTMLElement>(`[data-view-dialog="${CSS.escape(id)}"]`)
      target?.focus()
      setFocusedId(id)
    })
  })

  const focusedView = (): View | null => {
    const inFrame = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-view]")
    const all = [...state.subViews, ...state.sheet, ...(state.dialog ? [state.dialog] : [])]
    const byFocus = all.find((v) => v.id === (inFrame?.dataset["view"] ?? focusedId))
    if (state.dialog) return state.dialog
    return (
      byFocus ??
      all.find((v) => v.id === state.sheetSelected) ??
      all.find((v) => v.id === state.subSelected) ??
      null
    )
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey && event.shiftKey && event.key.toLowerCase() === "o")) return
      event.preventDefault()
      const view = focusedView()
      if (view === null || view.placements.length < 2) return
      const props = propsFor(view)
      if (variant.onCommand) return variant.onCommand(props)
      openers.current.get(`${view.id}@${props.from}`)?.()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  })

  const openTask = (view: View) =>
    setState((s) => (placementOf(s, view) === null ? opened(s, view, "sheet") : s))

  const subSelected = state.subViews.find((v) => v.id === state.subSelected) ?? null
  const sheetSelected = state.sheet.find((v) => v.id === state.sheetSelected) ?? null

  return (
    <div className="proto-app">
      <aside className="proto-card">
        <div className="proto-card-top">
          <div className="proto-lights">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="proto-sessions">
          <div className="proto-session" data-selected>
            <span className="proto-session-dot" /> Review checkout flow
          </div>
          <div className="proto-session">Fix flaky e2e on CI</div>
          <div className="proto-session">Rename settings keys</div>
        </div>
        <div className="proto-hint">
          <kbd>{variant.keyHint}</kbd> moves the view in focus
        </div>
      </aside>
      <main className="proto-main">
        <div className="proto-tabbar">
          <div className="proto-tab" data-selected>
            Review checkout flow
          </div>
          <div className="proto-tab">Fix flaky e2e on CI</div>
        </div>
        <div className="iv-tab-view__split">
          <div className="iv-tab-view__session">
            <div className="proto-transcript">
              <div className="proto-column">
                <p className="proto-user">Review the checkout changes and run the tests while you do.</p>
                <p>
                  I started a subagent to review the diff and left the test watcher running. I'll
                  report back when both are done.
                </p>
                <div className="proto-tasks">
                  <div className="proto-tasks-line">
                    <span className="proto-dot" /> 2 tasks in background
                  </div>
                  {[TASK, COMMAND].map((task) => (
                    <div key={task.id} className="proto-task" data-active={placementOf(state, task) !== null || undefined}>
                      <ViewIcon view={task} />
                      <span className="proto-task-name">{task.title}</span>
                      <button type="button" className="proto-pill" onClick={() => openTask(task)}>
                        {task.kind === "task" ? "Details" : "Output"}
                      </button>
                      <span className="proto-task-meta">{task.kind === "task" ? "8 tool calls" : "running 1m 40s"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="proto-dock" data-sheet={sheetSelected ? "" : undefined}>
              {sheetSelected && (
                <SheetFrame
                  variant={variant}
                  views={state.sheet}
                  selected={sheetSelected}
                  propsFor={propsFor}
                  select={(id) => setState((s) => ({ ...s, sheetSelected: id }))}
                  onFocusView={setFocusedId}
                />
              )}
              <div className="proto-composer">
                <span>Ask for a follow-up…</span>
                <span className="proto-send">
                  <Icon name="send" size={14} />
                </span>
              </div>
            </div>
          </div>
          {subSelected && (
            <SubViewCard
              variant={variant}
              views={state.subViews}
              selected={subSelected}
              propsFor={propsFor}
              select={(id) => setState((s) => ({ ...s, subSelected: id }))}
              onFocusView={setFocusedId}
            />
          )}
        </div>
      </main>
      {state.dialog && (
        <ViewDialog variant={variant} view={state.dialog} props={propsFor(state.dialog)} />
      )}
    </div>
  )
}

interface FrameProps {
  readonly variant: Variant
  readonly views: ReadonlyArray<View>
  readonly selected: View
  readonly propsFor: (view: View) => MoveProps
  readonly select: (id: string) => void
  readonly onFocusView: (id: string) => void
}

function Tab({
  variant,
  view,
  selected,
  props,
  onSelect,
  sheet,
}: {
  variant: Variant
  view: View
  selected: boolean
  props: MoveProps
  onSelect: () => void
  sheet: boolean
}) {
  const item = (
    <div className="iv-sub-view-card__item" data-selected={selected || undefined}>
      <button
        type="button"
        role="tab"
        className={sheet ? "iv-sub-view-card__tab iv-sheet__tab" : "iv-sub-view-card__tab"}
        aria-selected={selected}
        data-view-tab={view.id}
        onClick={onSelect}
      >
        <span className="iv-sub-view-card__icon" aria-hidden>
          <ViewIcon view={view} />
        </span>
        <span className="iv-sub-view-card__name">{view.title}</span>
      </button>
      {!sheet && (
        <button type="button" className="iv-sub-view-card__close" tabIndex={-1} aria-label={`Close ${view.title}`} onClick={props.close}>
          <Icon name="x" size={12} />
        </button>
      )}
    </div>
  )
  if (variant.TabWrapper === undefined || props.targets.length === 0) return item
  return (
    <variant.TabWrapper {...props} selected={selected}>
      {item}
    </variant.TabWrapper>
  )
}

function SheetFrame({ variant, views, selected, propsFor, select, onFocusView }: FrameProps) {
  const props = propsFor(selected)
  return (
    <div
      className="iv-sheet"
      role="region"
      aria-label="Views"
      data-view={selected.id}
      onFocus={() => onFocusView(selected.id)}
      onPointerDown={() => onFocusView(selected.id)}
    >
      <div className="iv-sub-view-card__row iv-sheet__row">
        <div className="iv-sub-view-card__tabs" role="tablist" aria-label="Open views">
          {views.map((view) => (
            <Tab
              key={view.id}
              variant={variant}
              view={view}
              sheet
              selected={view.id === selected.id}
              props={propsFor(view)}
              onSelect={() => select(view.id)}
            />
          ))}
        </div>
        {selected.kind === "task" && <span className="proto-meta">8 tool calls</span>}
        {variant.HeadControl && props.targets.length > 0 && <variant.HeadControl {...props} />}
        <button type="button" className="iv-sub-view-card__close iv-sheet__close" aria-label="Close the view" onClick={props.close}>
          <Icon name="x" size={12} />
        </button>
      </div>
      <div className="iv-sheet__body">
        <ViewContent view={selected} />
      </div>
    </div>
  )
}

function SubViewCard({ variant, views, selected, propsFor, select, onFocusView }: FrameProps) {
  const props = propsFor(selected)
  return (
    <section
      className="iv-sub-view-card"
      aria-label="Open files"
      data-view={selected.id}
      onFocus={() => onFocusView(selected.id)}
      onPointerDown={() => onFocusView(selected.id)}
    >
      <div className="iv-sub-view-card__row">
        <div className="iv-sub-view-card__tabs" role="tablist" aria-label="Open files">
          {views.map((view) => (
            <Tab
              key={view.id}
              variant={variant}
              view={view}
              sheet={false}
              selected={view.id === selected.id}
              props={propsFor(view)}
              onSelect={() => select(view.id)}
            />
          ))}
        </div>
        {variant.HeadControl && props.targets.length > 0 && <variant.HeadControl {...props} />}
        <IconButton icon="arrows-out" label="Full width" size="sm" />
      </div>
      <div className="iv-sub-view-card__body proto-card-body">
        <ViewContent view={selected} />
      </div>
    </section>
  )
}

function ViewDialog({ variant, view, props }: { variant: Variant; view: View; props: MoveProps }) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && props.close()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="iv-dialog__backdrop" />
        <Dialog.Popup className="iv-dialog iv-view-dialog" data-view={view.id}>
          <div className="proto-dialog-head">
            {variant.DialogTitle && props.targets.length > 0 ? (
              <variant.DialogTitle {...props} />
            ) : (
              <Dialog.Title className="iv-dialog__title">
                {view.title}
              </Dialog.Title>
            )}
            <span className="proto-grow" />
            {variant.HeadControl && props.targets.length > 0 && <variant.HeadControl {...props} />}
          </div>
          <div className="iv-view-dialog__body">
            <ViewContent view={view} />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ViewContent({ view }: { view: View }) {
  if (view.kind === "task") {
    return (
      <div className="proto-run">
        <div className="proto-run-line">
          <Icon name="loader" size={12} /> Working for 3m 12s
        </div>
        {[
          ["Read", "src/checkout/cart.ts"],
          ["Grep", "applyDiscount"],
          ["Read", "src/checkout/discount.ts"],
          ["Bash", "pnpm vitest run src/checkout"],
        ].map(([tool, arg], i) => (
          <div key={i} className="proto-step">
            <Icon name={tool === "Bash" ? "terminal" : "file"} size={14} />
            <strong>{tool}</strong>
            <code>{arg}</code>
          </div>
        ))}
        <p className="proto-step-text">
          The discount is applied before tax in <code>cart.ts</code> but after tax in{" "}
          <code>discount.ts</code>; checking which one the tests expect.
        </p>
      </div>
    )
  }
  if (view.kind === "command") {
    return (
      <pre className="proto-code">
        {` RUN  v3.2.4 /Users/ana/checkout\n\n ✓ src/checkout/cart.test.ts (12 tests) 41ms\n ✓ src/checkout/discount.test.ts (8 tests) 22ms\n ✗ src/checkout/tax.test.ts > rounds to the cent\n\n Test Files  1 failed | 2 passed (3)\n      Tests  1 failed | 20 passed (21)\n\n Waiting for file changes...`}
      </pre>
    )
  }
  if (view.kind === "diff") {
    return (
      <pre className="proto-code">
        <span className="proto-del">- const total = subtotal * (1 + tax) - discount</span>
        {"\n"}
        <span className="proto-add">+ const total = (subtotal - discount) * (1 + tax)</span>
        {"\n  return Math.round(total * 100) / 100"}
      </pre>
    )
  }
  return (
    <pre className="proto-code">
      {`# Checkout\n\nThe cart, its discounts and the taxes applied at payment.\n\n## Running it\n\n    pnpm install\n    pnpm dev\n\n## Tests\n\n    pnpm test`}
    </pre>
  )
}

export { PlacementIcon }
