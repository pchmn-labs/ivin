import { useEffect, useState, type ReactNode } from "react"
import { Block } from "../../src/core/components/block/block.tsx"
import { CodeBlock } from "../../src/core/components/code-block/code-block.tsx"
import { Disclosure } from "../../src/core/components/disclosure/disclosure.tsx"
import { HarnessMark } from "../../src/core/components/harness-mark/harness-mark.tsx"
import { Icon, type IconName } from "../../src/core/components/icon/icon.tsx"
import { Stack } from "../../src/core/components/stack/stack.tsx"
import { Text } from "../../src/core/components/text/text.tsx"
import { Tooltip } from "../../src/core/components/tooltip/tooltip.tsx"
import "../../src/core/components/block/block.css"
import "../../src/modules/session/ui/session-mark.css"
import "../../src/modules/transcript/ui/transcript-view.css"
import "../../src/modules/transcript/ui/turn-work.css"

type Task =
  | { id: string; kind: "agent"; name: string; model: string; since: string }
  | { id: string; kind: "command"; name: string; command: string; since: string }

const TASKS: Task[] = [
  { id: "a", kind: "agent", name: "Review the diff for race conditions", model: "sonnet", since: "3m 12s" },
  { id: "b", kind: "command", name: "End-to-end tests, shard 2", command: "pnpm test:e2e --shard 2/3", since: "1m 40s" },
  { id: "c", kind: "command", name: "Dev server", command: "pnpm dev", since: "6m 02s" },
]

type Kind = "read" | "search" | "command" | "edit"
interface Call {
  kind: Kind
  name: string
  arg: string
  out: string
  failed?: boolean
}
interface Step {
  sentence: string
  calls: Call[]
}
const ICONS: Record<Kind, IconName> = { read: "file", search: "search", command: "terminal", edit: "pencil" }

const STEPS: Step[] = [
  {
    sentence: "I'll start with the session runner, where the turn and the task list meet.",
    calls: [
      { kind: "read", name: "Read", arg: "apps/server/src/session-runs.ts", out: "export const setStatus = (run: Run, status: Status) =>\n  Effect.gen(function* () {\n    if (run.status === status) return\n    …" },
      { kind: "search", name: "Grep", arg: "setStatus", out: "apps/server/src/session-runs.ts:88\napps/server/src/session-runs.ts:141\napps/server/src/usecases/stop-session.ts:23" },
    ],
  },
  {
    sentence: "setStatus is called from the result handler and from the stop path. Checking they take the same lock.",
    calls: [
      { kind: "read", name: "Read", arg: "apps/server/src/session-lock.ts", out: "export const withSessionLock = …" },
      { kind: "read", name: "Read", arg: "apps/server/src/usecases/stop-session.ts", out: "const tasks = run.tasks.slice()\nyield* withSessionLock(…)" },
    ],
  },
  {
    sentence: "The stop path reads the task list before taking the lock. I'll check whether a test covers it.",
    calls: [
      { kind: "search", name: "Grep", arg: "stops a session with tasks", out: "No matches" },
      { kind: "command", name: "Bash", arg: "pnpm test apps/server/src/session-runs.test.ts", out: "✗ stops each background task once\n  expected 1 call, got 2", failed: true },
    ],
  },
  {
    sentence: "A task that ends between the read and the lock is stopped twice. I'll confirm with a focused test.",
    calls: [
      { kind: "edit", name: "Edit", arg: "apps/server/src/session-runs.test.ts", out: "+ test(\"stops each background task once\", …)" },
      { kind: "command", name: "Bash", arg: "pnpm test apps/server/src/session-runs.test.ts -t \"once\"", out: "✗ 1 failed" },
    ],
  },
]

const LOG_LINES = [
  "$ pnpm test:e2e --shard 2/3",
  "Running 18 tests using 2 workers",
  "  ✓  1 session.spec.ts:12 › starts a session (2.1s)",
  "  ✓  2 session.spec.ts:31 › stops a session (1.4s)",
  "  ✓  3 tabs.spec.ts:8 › opens a tab (0.9s)",
  "  ✓  4 tabs.spec.ts:22 › closes a tab (1.1s)",
  "  ✓  5 files.spec.ts:10 › opens a file (1.8s)",
  "  ✓  6 files.spec.ts:44 › filters the tree (2.6s)",
  "  ✓  7 worktree.spec.ts:15 › adopts a worktree (3.9s)",
  "  ✓  8 worktree.spec.ts:61 › removes a merged worktree (4.2s)",
  "  ✓  9 settings.spec.ts:9 › changes the theme (0.8s)",
  "  ✓ 10 settings.spec.ts:27 › restores defaults (1.0s)",
  "  ✓ 11 approvals.spec.ts:14 › allows a command (1.6s)",
  "  ✓ 12 approvals.spec.ts:40 › denies a command (1.2s)",
]
const DEV_LINES = [
  "$ pnpm dev",
  "  VITE v8.0.2  ready in 412 ms",
  "  ➜  Local:   http://localhost:5173/",
  "  hmr update /src/app/app.tsx",
  "  hmr update /src/modules/session/ui/session-mark.tsx",
]

// One clock for every view of a task, so the fold and the detail show the same run.
const START = Date.now()
function useNow(ms: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}
const useStepCount = () => Math.min(STEPS.length, 2 + Math.floor((useNow(500) - START) / 4000))
function useLog(task: Task) {
  const lines = task.id === "c" ? DEV_LINES : LOG_LINES
  const n = Math.min(lines.length, 4 + Math.floor((useNow(300) - START) / 1100))
  return lines.slice(0, n)
}

const phrases = (calls: Call[]) => {
  const count = (k: Kind) => calls.filter((c) => c.kind === k).length
  const out: string[] = []
  const cmd = count("command")
  if (cmd) out.push(cmd === 1 ? "Ran a command" : `Ran ${cmd} commands`)
  const read = count("read")
  if (read) out.push(read === 1 ? "read a file" : `read ${read} files`)
  if (count("edit")) out.push("edited a file")
  if (count("search")) out.push("searched")
  out[0] = out[0]![0]!.toUpperCase() + out[0]!.slice(1)
  return out.join(" · ")
}

function ToolCall({ call, running }: { call: Call; running: boolean }) {
  const header = (
    <Stack as="span" direction="row" gap={2} align="center" grow>
      <Icon name={ICONS[call.kind]} size={14} />
      <Text weight="medium">{call.name}</Text>
      <Stack as="span" grow>
        <Text size="sm" tone="muted" mono truncate>
          {call.arg}
        </Text>
      </Stack>
      {running && (
        <Text size="sm" tone="muted">
          <Icon name="loader" size={12} label="running" />
        </Text>
      )}
      {!running && call.failed && (
        <Text size="sm" tone="danger">
          failed
        </Text>
      )}
    </Stack>
  )
  if (running) return header
  return (
    <Disclosure variant="row" summary={header}>
      <CodeBlock text={call.out} />
    </Disclosure>
  )
}

function StepView({ step, current, defaultOpen }: { step: Step; current: boolean; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const failed = step.calls.filter((c) => c.failed).length
  return (
    <div className="iv-turn__step" data-failed={failed > 0 || undefined} data-current={current || undefined}>
      <div className="iv-turn__sentence">
        <p className="proto-prose">{step.sentence}</p>
      </div>
      <button type="button" className="iv-turn__summary" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="iv-turn__lead">
          <span className="iv-turn__mark" data-state={current ? "running" : undefined}>
            {current ? <Icon name="loader" size={12} /> : <Icon name="stack" size={14} />}
          </span>
          <span className="iv-turn__chevron">
            <Icon name="chevron-right" size={12} />
          </span>
        </span>
        <span className="iv-turn__phrases">
          {phrases(step.calls)}
          {failed > 0 && (
            <>
              <span className="iv-turn__dot"> · </span>
              <span className="iv-turn__failed">{failed} failed</span>
            </>
          )}
        </span>
      </button>
      {open && (
        <div className="iv-turn__calls">
          {step.calls.map((call, i) => (
            <div key={i} className="iv-turn__call">
              <ToolCall call={call} running={current && i === step.calls.length - 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// The subagent's run, drawn as ivin draws a running turn: its last 3 steps in the fold, all of them in the detail.
function Run({ lastOnly }: { lastOnly: boolean }) {
  const n = useStepCount()
  const shown = STEPS.slice(0, n)
  const [earlierOpen, setEarlierOpen] = useState(false)
  const hidden = lastOnly && !earlierOpen ? Math.max(0, shown.length - 3) : 0
  const failed = shown.slice(0, hidden).flatMap((s) => s.calls).filter((c) => c.failed).length
  return (
    <div className="iv-turn">
      {!lastOnly && (
        <div className="iv-turn__line">
          <span className="iv-turn__lead">
            <span className="iv-turn__mark" data-state="running">
              <Icon name="loader" size={12} />
            </span>
          </span>
          <span className="iv-turn__label">Working for 3m 12s</span>
          <span className="iv-turn__rule" />
        </div>
      )}
      <div className="iv-turn__timeline">
        {lastOnly && shown.length > 3 && (
          <div className="iv-turn__earlier">
            <button type="button" className="iv-turn__earlier-line" aria-expanded={earlierOpen} onClick={() => setEarlierOpen(!earlierOpen)}>
              <span>
                {earlierOpen ? `Hide ${shown.length - 3} earlier steps` : `${hidden} earlier steps`}
                {failed > 0 && (
                  <>
                    <span className="iv-turn__dot"> · </span>
                    <span className="iv-turn__failed">{failed} failed</span>
                  </>
                )}
              </span>
              <span className="iv-turn__chevron">
                <Icon name="chevron-right" size={12} />
              </span>
            </button>
          </div>
        )}
        {shown.slice(hidden).map((step, i) => {
          const current = hidden + i === shown.length - 1
          return <StepView key={step.sentence} step={step} current={current} defaultOpen={lastOnly ? current : true} />
        })}
      </div>
    </div>
  )
}

function Log({ task, tail }: { task: Task; tail?: number }) {
  const lines = useLog(task)
  return <CodeBlock text={(tail ? lines.slice(-tail) : lines).join("\n")} />
}

const Detail = ({ task }: { task: Task }) => (task.kind === "agent" ? <Run lastOnly={false} /> : <Log task={task} />)

const taskIcon = (task: Task): IconName => (task.kind === "agent" ? "robot" : "terminal")

function BackgroundMark({ status = "background" }: { status?: "background" | "working" | "idle" }) {
  return (
    <span className="iv-session-mark" data-status={status}>
      <HarnessMark mark="claude" />
      <span className="iv-session-mark__overlay" aria-hidden="true" />
    </span>
  )
}

function WithTasksTooltip({ children }: { children: ReactNode }) {
  return (
    <Tooltip
      label="3 tasks in background"
      side="bottom"
      content={
        <ul className="proto-tip-list">
          {TASKS.map((t) => (
            <li key={t.id}>
              <Icon name={taskIcon(t)} size={12} />
              <span>{t.name}</span>
            </li>
          ))}
        </ul>
      }
    >
      <span className="proto-tip-anchor">{children}</span>
    </Tooltip>
  )
}

function Sidebar() {
  return (
    <aside className="proto-sidebar">
      <div className="proto-side-head">ivin</div>
      <div className="proto-side-list">
        <div className="proto-row" data-selected>
          <WithTasksTooltip>
            <BackgroundMark />
          </WithTasksTooltip>
          <span className="proto-row-title">Fix the double stop on tab close</span>
          <span className="proto-row-time">now</span>
        </div>
        <div className="proto-row">
          <BackgroundMark status="working" />
          <span className="proto-row-title">Speed up Go to file</span>
          <span className="proto-row-time">2m</span>
        </div>
        <div className="proto-row">
          <BackgroundMark status="idle" />
          <span className="proto-row-title">Rename the glossary entries</span>
          <span className="proto-row-time">1h</span>
        </div>
      </div>
      <div className="proto-working">
        <div className="proto-working-head">Running</div>
        <div className="proto-working-card">
          <WithTasksTooltip>
            <BackgroundMark />
          </WithTasksTooltip>
          <div className="proto-working-text">
            <span className="proto-row-title">Fix the double stop on tab close</span>
            <span className="proto-working-activity">[bg] Review the diff for race conditions +2</span>
          </div>
        </div>
        <div className="proto-working-card">
          <BackgroundMark status="working" />
          <div className="proto-working-text">
            <span className="proto-row-title">Speed up Go to file</span>
            <span className="proto-working-activity">Bash pnpm test go-to-file</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

function TabBar() {
  return (
    <header className="proto-titlebar">
      <span className="proto-tab" data-selected>
        <BackgroundMark />
        <span>Fix the double stop on tab close</span>
      </span>
      <span className="proto-tab">
        <BackgroundMark status="working" />
        <span>Speed up Go to file</span>
      </span>
    </header>
  )
}

function TaskMeta({ task }: { task: Task }) {
  const n = useStepCount()
  if (task.kind === "command") return <span className="proto-task-meta">running {task.since}</span>
  const failed = STEPS.slice(0, n).flatMap((s) => s.calls).filter((c) => c.failed).length
  const calls = STEPS.slice(0, n).flatMap((s) => s.calls).length
  return (
    <span className="proto-task-meta">
      {task.model} · {calls} tool calls
      {failed > 0 && <span className="iv-turn__failed"> · {failed} failed</span>}
    </span>
  )
}

// A task row as MonoCode draws it: the row unfolds in place, its Details pill opens the whole run.
function TaskRow({ task, onOpen, active }: { task: Task; onOpen: (t: Task) => void; active: boolean }) {
  const [open, setOpen] = useState(false)
  const pill = task.kind === "agent" ? "Details" : "Output"
  return (
    <div className="proto-task-block" data-active={active || undefined}>
      <button type="button" className="proto-task" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name={taskIcon(task)} size={14} />
        <span className="proto-task-name">{task.name}</span>
        <span
          role="button"
          tabIndex={0}
          className="proto-pill"
          onClick={(e) => {
            e.stopPropagation()
            onOpen(task)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              e.stopPropagation()
              onOpen(task)
            }
          }}
        >
          {pill}
        </span>
        <span className="proto-task-spacer" />
        <TaskMeta task={task} />
        <span className="proto-task-chevron" data-open={open || undefined}>
          <Icon name="chevron-right" size={12} />
        </span>
      </button>
      {open && <div className="proto-peek">{task.kind === "agent" ? <Run lastOnly /> : <Log task={task} tail={5} />}</div>}
    </div>
  )
}

function Fold({ onOpen, activeId }: { onOpen: (t: Task) => void; activeId: string | null }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="proto-fold">
      <button type="button" className="iv-turn__line iv-turn__line--toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="proto-fold-dot" />
        <span className="iv-turn__label">3 tasks in background</span>
        <span className="iv-turn__chevron" data-open={open || undefined}>
          <Icon name="chevron-right" size={12} />
        </span>
        <span className="iv-turn__rule" />
      </button>
      {open && (
        <div className="proto-fold-list">
          {TASKS.map((t) => (
            <TaskRow key={t.id} task={t} onOpen={onOpen} active={activeId === t.id} />
          ))}
        </div>
      )}
    </div>
  )
}

const Item = ({ children }: { children: ReactNode }) => <div className="iv-transcript__item">{children}</div>

function Transcript({ fold }: { fold: ReactNode }) {
  return (
    <div className="proto-scroll">
      <div className="iv-transcript__column">
        <Item>
          <Block tone="bubble">
            <p className="proto-prose">
              Closing a tab stops the agent twice when it still has tasks running. Find out why, fix it, and run the end-to-end tests.
            </p>
          </Block>
        </Item>
        <Item>
          <div className="iv-turn">
            <div className="iv-turn__line">
              <span className="iv-turn__lead">
                <span className="iv-turn__mark" data-outcome="answered">
                  <Icon name="check" size={14} />
                </span>
              </span>
              <span className="iv-turn__label">Worked for 2m 10s · 5 tool calls</span>
              <span className="iv-turn__rule" />
            </div>
          </div>
        </Item>
        <Item>{fold}</Item>
        <Item>
          <p className="proto-prose">
            A subagent is reviewing the runner while the end-to-end tests and the dev server run. I'll pick up when they report back.
          </p>
        </Item>
      </div>
    </div>
  )
}

function Composer() {
  return (
    <div className="proto-composer-column">
      <div className="proto-composer">
        <span className="proto-placeholder">Ask, build, or paste an image…</span>
        <span className="proto-send">
          <Icon name="send" size={14} />
        </span>
      </div>
    </div>
  )
}

function Window({ children, pane }: { children: ReactNode; pane?: ReactNode }) {
  return (
    <div className="proto-app">
      <Sidebar />
      <div className="proto-window">
        <TabBar />
        <div className="proto-body">
          <main className="proto-main">{children}</main>
          {pane}
        </div>
      </div>
    </div>
  )
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  })
}

function DetailHeader({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <div className="proto-detail-head">
      <Icon name={taskIcon(task)} size={14} />
      <span className="proto-detail-title">{task.name}</span>
      <TaskMeta task={task} />
      <button type="button" className="proto-ghost" onClick={onClose} aria-label="Close">
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

function ApprovalSheet() {
  return (
    <div className="proto-approval">
      <div className="proto-approval-head">
        <Icon name="circle-alert" size={14} />
        <span className="proto-approval-title">Allow this command?</span>
        <span className="proto-approval-detail">git push --force-with-lease origin fix/double-stop</span>
      </div>
      <div className="proto-approval-actions">
        <span className="proto-hint">↑↓ Navigate · Enter Select · Esc Deny</span>
        <span className="proto-btn">Deny</span>
        <span className="proto-btn" data-primary>
          Allow
        </span>
      </div>
    </div>
  )
}

export function Sheet() {
  const [open, setOpen] = useState<Task | null>(null)
  const [approval, setApproval] = useState(false)
  const [height, setHeight] = useState(320)
  useEscape(() => setOpen(null))
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    const startY = e.clientY
    const start = height
    const move = (ev: PointerEvent) => setHeight(clamp(start + startY - ev.clientY, 120, window.innerHeight - 360))
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }
  return (
    <Window>
      <label className="proto-demo">
        <input type="checkbox" checked={approval} onChange={(e) => setApproval(e.target.checked)} /> Approval pending
      </label>
      <Transcript fold={<Fold onOpen={setOpen} activeId={open?.id ?? null} />} />
      <div className="proto-dock">
        {open && (
          <div className="proto-sheet" data-stacked={approval || undefined} style={{ height }} key={open.id}>
            <div className="proto-grip" onPointerDown={drag} onDoubleClick={() => setHeight(320)} role="separator" aria-orientation="horizontal" aria-label="Resize" />
            <DetailHeader task={open} onClose={() => setOpen(null)} />
            <div className="proto-sheet-body">
              <Detail task={open} />
            </div>
          </div>
        )}
        {approval && <ApprovalSheet />}
        <Composer />
      </div>
    </Window>
  )
}

const CODE = [
  "export function setStatus(run: Run, status: Status) {",
  "  if (run.status === status) return",
  "  run.status = status",
  "  publish(run.sessionId, { type: \"status\", status })",
  "}",
  "",
  "export function stopRun(run: Run) {",
  "  const tasks = run.tasks.slice()",
  "  for (const task of tasks) task.stop()",
  "  run.child.kill()",
  "}",
]

type CardTab = { kind: "file"; name: string } | { kind: "task"; task: Task }
const tabKey = (t: CardTab) => (t.kind === "file" ? `f:${t.name}` : `t:${t.task.id}`)

export function CardTabs() {
  const [tabs, setTabs] = useState<CardTab[]>([
    { kind: "file", name: "session-runs.ts" },
    { kind: "file", name: "session-lock.ts" },
  ])
  const [sel, setSel] = useState("f:session-runs.ts")
  const openTask = (task: Task) => {
    const tab: CardTab = { kind: "task", task }
    setTabs((ts) => (ts.some((t) => tabKey(t) === tabKey(tab)) ? ts : [...ts, tab]))
    setSel(tabKey(tab))
  }
  const close = (key: string) => {
    const rest = tabs.filter((t) => tabKey(t) !== key)
    setTabs(rest)
    if (sel === key && rest[0]) setSel(tabKey(rest[rest.length - 1]!))
  }
  const current = tabs.find((t) => tabKey(t) === sel)
  return (
    <Window
      pane={
        tabs.length > 0 && (
          <aside className="proto-pane">
            <div className="proto-pane-tabs" role="tablist">
              {tabs.map((t) => (
                <span key={tabKey(t)} role="tab" className="proto-pane-tab" data-active={tabKey(t) === sel || undefined} onClick={() => setSel(tabKey(t))}>
                  {t.kind === "file" ? <Icon name="file" size={14} /> : <span className="proto-tab-dot" />}
                  <span>{t.kind === "file" ? t.name : t.task.name}</span>
                  <button
                    type="button"
                    className="proto-tab-close"
                    aria-label="Close"
                    onClick={(e) => {
                      e.stopPropagation()
                      close(tabKey(t))
                    }}
                  >
                    <Icon name="x" size={12} />
                  </button>
                </span>
              ))}
            </div>
            {current?.kind === "task" && <DetailHeader task={current.task} onClose={() => close(sel)} />}
            <div className="proto-pane-body">
              {current?.kind === "file" && <pre className="proto-code">{CODE.map((l, i) => `${String(i + 1).padStart(2)}  ${l}`).join("\n")}</pre>}
              {current?.kind === "task" && <Detail key={current.task.id} task={current.task} />}
            </div>
          </aside>
        )
      }
    >
      <Transcript fold={<Fold onOpen={openTask} activeId={sel.startsWith("t:") ? sel.slice(2) : null} />} />
      <Composer />
    </Window>
  )
}

export function Dialog() {
  const [open, setOpen] = useState<Task | null>(null)
  useEscape(() => setOpen(null))
  return (
    <>
      <Window>
        <Transcript fold={<Fold onOpen={setOpen} activeId={open?.id ?? null} />} />
        <Composer />
      </Window>
      {open && (
        <>
          <div className="proto-backdrop" onClick={() => setOpen(null)} />
          <div className="proto-dialog" role="dialog" aria-modal="true" aria-label={open.name}>
            <DetailHeader task={open} onClose={() => setOpen(null)} />
            <div className="proto-dialog-body">
              <div className="proto-dialog-column">
                <Detail task={open} />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
