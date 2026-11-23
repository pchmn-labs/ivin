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

function ToolRow({ task }: { task: Task }) {
  return (
    <div className="proto-toolrow">
      <Icon name={task.kind === "agent" ? "robot" : "terminal"} size={14} />
      <span className="proto-tool-name">{task.kind === "agent" ? "Agent" : "Bash"}</span>
      <span className="proto-tool-arg">{task.kind === "agent" ? task.name : task.command}</span>
      <span className="proto-bgchip">In background</span>
    </div>
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
            <div className="proto-calls">
              {TASKS.map((t) => (
                <ToolRow key={t.id} task={t} />
              ))}
            </div>
          </div>
        </Item>
        <Item>{fold}</Item>
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

export function Sheet() {
  const [open, setOpen] = useState<Task | null>(TASKS[1]!)
  useEscape(() => setOpen(null))
  return (
    <Window>
      <Transcript
        fold={
          <Fold
            renderRow={(t) => (
              <div key={t.id} className="proto-task" data-active={open?.id === t.id || undefined}>
                <TaskIcon task={t} />
                <span className="proto-task-name">{t.name}</span>
                <span className="proto-task-meta">{t.since}</span>
                <button type="button" className="proto-pill" onClick={() => setOpen(t)}>
                  {t.kind === "agent" ? "Details" : "Output"}
                </button>
              </div>
            )}
          />
        }
      />
      <div className="proto-dock">
        {open && (
          <div className="proto-sheet" key={open.id}>
            <DetailHeader task={open} onClose={() => setOpen(null)} />
            <div className="proto-sheet-body">
              <Body task={open} />
            </div>
          </div>
        )}
        <Composer />
      </div>
    </Window>
  )
}

export function Inline() {
  const [open, setOpen] = useState<string | null>("a")
  return (
    <Window>
      <Transcript
        fold={
          <Fold
            renderRow={(t) => (
              <div key={t.id} className="proto-task-block">
                <button type="button" className="proto-task" aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? null : t.id)}>
                  <span className="proto-task-chevron" data-open={open === t.id || undefined}>
                    <Icon name="chevron-right" size={12} />
                  </span>
                  <TaskIcon task={t} />
                  <span className="proto-task-name">{t.name}</span>
                  <span className="proto-task-meta">{t.since}</span>
                </button>
                {open === t.id && (
                  <div className="proto-inline-body">
                    <Body task={t} />
                  </div>
                )}
              </div>
            )}
          />
        }
      />
      <Composer />
    </Window>
  )
}

export function SidePane() {
  const [open, setOpen] = useState<Task | null>(TASKS[0]!)
  useEscape(() => setOpen(null))
  return (
    <Window
      pane={
        open && (
          <aside className="proto-pane" key={open.id}>
            <DetailHeader task={open} onClose={() => setOpen(null)} />
            <div className="proto-pane-tabs">
              {TASKS.map((t) => (
                <button key={t.id} type="button" className="proto-pane-tab" data-active={t.id === open.id || undefined} onClick={() => setOpen(t)}>
                  <TaskIcon task={t} />
                  {t.kind === "agent" ? "Subagent" : t.command.split(" ").slice(0, 2).join(" ")}
                </button>
              ))}
            </div>
            <div className="proto-pane-body">
              <Body task={open} />
            </div>
          </aside>
        )
      }
    >
      <Transcript
        fold={
          <Fold
            renderRow={(t) => (
              <button key={t.id} type="button" className="proto-task" data-active={open?.id === t.id || undefined} onClick={() => setOpen(t)}>
                <TaskIcon task={t} />
                <span className="proto-task-name">{t.name}</span>
                <span className="proto-task-meta">{t.since}</span>
                <Icon name="arrow-right" size={12} />
              </button>
            )}
          />
        }
      />
      <Composer />
    </Window>
  )
}
