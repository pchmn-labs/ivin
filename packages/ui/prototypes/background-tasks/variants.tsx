import { useEffect, useState, type ReactNode } from "react"
import { Block } from "../../src/core/components/block/block.tsx"
import { HarnessMark } from "../../src/core/components/harness-mark/harness-mark.tsx"
import { Icon } from "../../src/core/components/icon/icon.tsx"
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

const AGENT_STEPS: { kind: "text" | "tool"; icon?: "file" | "search" | "terminal"; name?: string; arg?: string; out?: string; text?: string }[] = [
  { kind: "text", text: "I'll start with the session runner, where the turn and the task list meet." },
  { kind: "tool", icon: "file", name: "Read", arg: "apps/server/src/session-runs.ts", out: "412 lines" },
  { kind: "tool", icon: "search", name: "Grep", arg: "setStatus", out: "9 matches in 3 files" },
  { kind: "text", text: "setStatus is called from the result handler and from the stop path. Checking they take the same lock." },
  { kind: "tool", icon: "file", name: "Read", arg: "apps/server/src/session-lock.ts", out: "88 lines" },
  { kind: "tool", icon: "terminal", name: "Bash", arg: "pnpm test apps/server/src/session-runs.test.ts", out: "14 passed" },
  { kind: "text", text: "The stop path reads the task list before taking the lock. A task that ends in between is stopped twice." },
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
]

function useTicker(max: number, ms: number, start = 1) {
  const [n, setN] = useState(start)
  useEffect(() => {
    const t = setInterval(() => setN((v) => Math.min(v + 1, max)), ms)
    return () => clearInterval(t)
  }, [max, ms])
  return n
}

function BackgroundMark({ status = "background" }: { status?: "background" | "working" | "idle" }) {
  return (
    <span className="iv-session-mark" data-status={status}>
      <HarnessMark mark="claude" />
      <span className="iv-session-mark__overlay" aria-hidden="true" />
    </span>
  )
}

const TaskList = ({ tasks = TASKS }: { tasks?: Task[] }) => (
  <ul className="proto-tip-list">
    {tasks.map((t) => (
      <li key={t.id}>
        <Icon name={t.kind === "agent" ? "robot" : "terminal"} size={12} />
        <span>{t.name}</span>
      </li>
    ))}
  </ul>
)

function WithTasksTooltip({ children }: { children: ReactNode }) {
  return (
    <Tooltip label="3 tasks in background" content={<TaskList />} side="bottom">
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

function Trail({ live = true }: { live?: boolean }) {
  const n = useTicker(AGENT_STEPS.length, 1400, live ? 3 : AGENT_STEPS.length)
  return (
    <div className="proto-trail">
      {AGENT_STEPS.slice(0, n).map((s, i) =>
        s.kind === "text" ? (
          <p key={i} className="proto-trail-text">
            {s.text}
          </p>
        ) : (
          <div key={i} className="proto-trail-tool">
            <div className="proto-toolrow">
              <Icon name={s.icon!} size={14} />
              <span className="proto-tool-name">{s.name}</span>
              <span className="proto-tool-arg">{s.arg}</span>
            </div>
            <div className="proto-trail-out">{s.out}</div>
          </div>
        ),
      )}
      <div className="proto-live">
        <span className="proto-live-dot" /> Working…
      </div>
    </div>
  )
}

function Log({ task }: { task: Task }) {
  const n = useTicker(LOG_LINES.length, task.id === "c" ? 2500 : 900, task.id === "c" ? 1 : 4)
  const lines = task.id === "c" ? ["$ pnpm dev", "  VITE v8.0.2  ready in 412 ms", "  ➜  Local:   http://localhost:5173/", "  hmr update /src/app/app.tsx"] : LOG_LINES
  return (
    <pre className="proto-log">
      {lines.slice(0, Math.min(n, lines.length)).join("\n")}
      <span className="proto-caret" />
    </pre>
  )
}

const Body = ({ task }: { task: Task }) => (task.kind === "agent" ? <Trail /> : <Log task={task} />)

function TaskIcon({ task }: { task: Task }) {
  return <Icon name={task.kind === "agent" ? "robot" : "terminal"} size={14} />
}


const STAT: Record<string, string> = { a: "9 steps, 1 failed", b: "running", c: "running" }

function TaskRow({ task, onOpen, active }: { task: Task; onOpen: (t: Task) => void; active: boolean }) {
  const [open, setOpen] = useState(false)
  const steps = useTicker(AGENT_STEPS.length, 1400, 3)
  const lines = useTicker(LOG_LINES.length, 900, 4)
  return (
    <div className="proto-task-block" data-active={active || undefined}>
      <button type="button" className="proto-task" aria-expanded={open} onClick={() => setOpen(!open)}>
        <TaskIcon task={task} />
        <span className="proto-task-name">{task.name}</span>
        <span className="proto-task-meta">{task.kind === "agent" ? `${task.model} · ` : ""}{task.kind === "agent" ? `${steps + 6} steps` : STAT[task.id]}</span>
        <span className="proto-task-chevron" data-open={open || undefined}>
          <Icon name="chevron-right" size={12} />
        </span>
      </button>
      {open && (
        <div className="proto-peek">
          {task.kind === "agent" ? (
            AGENT_STEPS.slice(0, steps).map((st, i) => (
              <div key={i} className="proto-peek-line">
                {st.kind === "text" ? st.text : `${st.name} ${st.arg}`}
              </div>
            ))
          ) : (
            <pre className="proto-peek-log">{LOG_LINES.slice(Math.max(0, lines - 5), lines).join("\n")}</pre>
          )}
          <button type="button" className="proto-pill" data-shown onClick={() => onOpen(task)}>
            {task.kind === "agent" ? "Open details" : "Open output"}
          </button>
        </div>
      )}
    </div>
  )
}

interface FoldProps {
  renderRow: (task: Task) => ReactNode
}
function Fold({ renderRow }: FoldProps) {
  const [open, setOpen] = useState(false)
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
      {open && <div className="proto-fold-list">{TASKS.map((t) => renderRow(t))}</div>}
    </div>
  )
}

const Item = ({ children }: { children: ReactNode }) => (
  <div className="iv-transcript__item">{children}</div>
)

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
          <p className="proto-prose">
            I'll have a subagent review the runner while I start the end-to-end tests and the dev server. I'll pick up when they report back.
          </p>
        </Item>
        <Item>
          <div className="iv-turn">
            <div className="iv-turn__line">
              <span className="iv-turn__label">Worked for 2m 10s · 5 tool calls</span>
              <span className="iv-turn__rule" />
            </div>
          </div>
        </Item>
        <Item>{fold}</Item>
        <Item>
          <p className="proto-prose">
            The subagent is reading the runner and the tests are running. When they report back I'll fix the double stop and run the full check.
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
        <span className="proto-placeholder">Message Claude, or wait for the tasks…</span>
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
      <TaskIcon task={task} />
      <span className="proto-detail-title">{task.name}</span>
      <span className="proto-detail-meta">{task.kind === "agent" ? `${task.model} · ` : ""}running {task.since}</span>
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
        <span className="proto-btn" data-primary>Allow</span>
      </div>
    </div>
  )
}

export function Sheet() {
  const [open, setOpen] = useState<Task | null>(null)
  const [approval, setApproval] = useState(true)
  const [height, setHeight] = useState(280)
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
      <Transcript
        fold={
          <Fold
            renderRow={(t) => <TaskRow key={t.id} task={t} onOpen={setOpen} active={open?.id === t.id} />}
          />
        }
      />
      <div className="proto-dock">
        {open && (
          <div className="proto-sheet" data-stacked={approval || undefined} style={{ height }} key={open.id}>
            <div className="proto-grip" onPointerDown={drag} onDoubleClick={() => setHeight(280)} role="separator" aria-orientation="horizontal" aria-label="Resize" />
            <DetailHeader task={open} onClose={() => setOpen(null)} />
            <div className="proto-sheet-body">
              <Body task={open} />
            </div>
          </div>
        )}
        {approval && <ApprovalSheet />}
        <Composer />
      </div>
    </Window>
  )
}

const FILES = ["session-runs.ts", "session-lock.ts"]
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

type Tab = { kind: "file"; name: string } | { kind: "task"; task: Task }
const tabKey = (t: Tab) => (t.kind === "file" ? `f:${t.name}` : `t:${t.task.id}`)

export function SidePane() {
  const [tabs, setTabs] = useState<Tab[]>(FILES.map((name) => ({ kind: "file", name })))
  const [sel, setSel] = useState<string>("f:session-runs.ts")
  const openTask = (task: Task) => {
    const tab: Tab = { kind: "task", task }
    setTabs((ts) => (ts.some((t) => tabKey(t) === tabKey(tab)) ? ts : [...ts, tab]))
    setSel(tabKey(tab))
  }
  const close = (key: string) => {
    setTabs((ts) => ts.filter((t) => tabKey(t) !== key))
    if (sel === key) setSel(tabKey(tabs[0]!) === key ? tabKey(tabs[1]!) : tabKey(tabs[0]!))
  }
  const current = tabs.find((t) => tabKey(t) === sel)
  return (
    <Window
      pane={
        <aside className="proto-pane">
          <div className="proto-pane-tabs" role="tablist">
            {tabs.map((t) => (
              <span key={tabKey(t)} role="tab" className="proto-pane-tab" data-active={tabKey(t) === sel || undefined} onClick={() => setSel(tabKey(t))}>
                {t.kind === "file" ? <Icon name="file" size={14} /> : <span className="proto-tab-dot" />}
                <span>{t.kind === "file" ? t.name : t.task.kind === "agent" ? "Subagent" : t.task.command.split(" ").slice(0, 2).join(" ")}</span>
                <button type="button" className="proto-tab-close" aria-label="Close" onClick={(e) => { e.stopPropagation(); close(tabKey(t)) }}>
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="proto-pane-body">
            {current?.kind === "file" && (
              <pre className="proto-code">{CODE.map((l, i) => `${String(i + 1).padStart(2)}  ${l}`).join("\n")}</pre>
            )}
            {current?.kind === "task" && <Body key={current.task.id} task={current.task} />}
          </div>
        </aside>
      }
    >
      <Transcript
        fold={
          <Fold
            renderRow={(t) => <TaskRow key={t.id} task={t} onOpen={openTask} active={sel === `t:${t.id}`} />}
          />
        }
      />
      <Composer />
    </Window>
  )
}
