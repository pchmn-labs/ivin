import { useEffect, useState, type ReactNode } from "react"
import { Block } from "../../src/core/components/block/block.tsx"
import { Button } from "../../src/core/components/button/button.tsx"
import { CodeBlock } from "../../src/core/components/code-block/code-block.tsx"
import { Dialog } from "../../src/core/components/dialog/dialog.tsx"
import { ErrorMessage } from "../../src/core/components/error-message/error-message.tsx"
import { Icon } from "../../src/core/components/icon/icon.tsx"
import "../../src/core/components/block/block.css"
import "./prototype.css"

type Scene = "archive" | "window" | "transcript"
const SCENES: { id: Scene; label: string }[] = [
  { id: "archive", label: "Archive with unsaved edits" },
  { id: "window", label: "Error drawing the window" },
  { id: "transcript", label: "Transcript cannot load" },
]
const FILES = ["src/router.ts", "src/auth/session.ts", "README.md"]
const STACK = "TypeError: Cannot read properties of undefined (reading 'title')\n    at SessionRow (session-row.tsx:41:18)\n    at renderWithHooks (react-dom.js:15486)"

function Shell({ sidebar = true, children }: { sidebar?: boolean; children: ReactNode }) {
  return (
    <div className="proto-window">
      {sidebar && (
        <div className="proto-sidebar">
          <div className="proto-row" data-active>Fix the login redirect</div>
          <div className="proto-row">Add rate limiting</div>
          <div className="proto-row">Migrate to Drizzle</div>
        </div>
      )}
      <div className="proto-main">{children}</div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="proto-chat" aria-hidden>
      {[80, 100, 60, 90, 40].map((w, i) => <div key={i} className="proto-ghost" style={{ width: `${w}%` }} />)}
    </div>
  )
}

function useScene() {
  const [scene, setSceneState] = useState<Scene>(
    (new URLSearchParams(location.search).get("s") as Scene | null) ?? "archive",
  )
  const setScene = (next: Scene) => {
    const url = new URL(location.href)
    url.searchParams.set("s", next)
    history.replaceState(null, "", url)
    setSceneState(next)
  }
  useEffect(() => {
    const keys: Record<string, Scene> = { a: "archive", w: "window", t: "transcript" }
    const onKey = (e: KeyboardEvent) => {
      const next = keys[e.key]
      if (next && !e.metaKey && !e.ctrlKey && !e.altKey) setScene(next)
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [])
  const picker = (
    <div className="proto-scenes">
      {SCENES.map((s) => (
        <button key={s.id} className="proto-scene" aria-pressed={scene === s.id} onClick={() => setScene(s.id)}>{s.label} ({s.id[0]})</button>
      ))}
    </div>
  )
  return { scene, picker }
}

function ArchiveDialog({ variant, running, onClose }: { variant: 1 | 2 | 3; running: boolean; onClose: () => void }) {
  const actions = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="danger" onClick={onClose}>{running ? "Stop and archive" : "Archive and drop edits"}</Button>
    </>
  )
  const title = "Archive “Fix the login redirect”?"
  if (variant === 1) {
    return (
      <Dialog open onOpenChange={onClose} title={title} actions={actions}
        description={`${running ? "The agent is still working and stops. " : ""}Your unsaved edits to ${FILES.join(", ")} are lost.`} />
    )
  }
  if (variant === 2) {
    return (
      <Dialog open onOpenChange={onClose} title={title} description="Archiving cannot keep everything." actions={actions}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {running && (
            <div className="proto-consequence"><Icon name="loader" size={14} /><span>The agent is working. Archiving stops it.</span></div>
          )}
          <div className="proto-consequence"><Icon name="circle-alert" size={14} /><span>{FILES.length} files have unsaved edits, which are lost:</span></div>
          <ul className="proto-files">{FILES.map((f) => <li key={f} className="proto-file"><span className="proto-dot" />{f}</li>)}</ul>
        </div>
      </Dialog>
    )
  }
  return (
    <Dialog open onOpenChange={onClose} title={`${FILES.length} files with unsaved edits`}
      description={`${title.replace("?", "")} drops them${running ? " and stops the agent" : ""}. This cannot be undone.`} actions={actions}>
      <ul className="proto-files">{FILES.map((f) => <li key={f} className="proto-file"><span className="proto-dot" />{f}</li>)}</ul>
    </Dialog>
  )
}

function make(variant: 1 | 2 | 3) {
  return function Variant() {
    const { scene, picker } = useScene()
    const [open, setOpen] = useState(true)
    const [running, setRunning] = useState(true)
    return (
      <>
        {picker}
        {scene === "archive" && (
          <Shell>
            <div className="proto-center">
              <Button variant="secondary" onClick={() => setOpen(true)}>Archive session…</Button>
              <Button variant="ghost" size="sm" onClick={() => setRunning(!running)}>Agent {running ? "running" : "idle"} (toggle)</Button>
            </div>
            {open && <ArchiveDialog variant={variant} running={running} onClose={() => setOpen(false)} />}
          </Shell>
        )}
        {scene === "window" && (
          variant === 1 ? (
            <Shell sidebar={false}>
              <div className="proto-center">
                <p className="proto-title">ivin hit a problem</p>
                <ErrorMessage message="Something went wrong while drawing the window." />
                <div className="proto-actions"><Button variant="primary">Try again</Button><Button variant="secondary">Reload window</Button></div>
              </div>
            </Shell>
          ) : variant === 2 ? (
            <Shell sidebar={false}>
              <div className="proto-center proto-center--wide">
                <Block tone="danger" padding={4} className="proto-block">
                  <p className="proto-title">The window stopped drawing</p>
                  <p style={{ color: "var(--iv-text-muted)", fontSize: "var(--iv-text-sm)" }}>Your drafts and unsaved edits are kept while you try again. Reload window drops them.</p>
                  <CodeBlock text={STACK} />
                  <div className="proto-actions" style={{ marginTop: 12 }}><Button variant="primary">Try again</Button><Button variant="secondary">Reload window</Button></div>
                </Block>
                <span style={{ color: "var(--iv-text-faint)", fontSize: "var(--iv-text-xs)" }}>Written to ivin logs</span>
              </div>
            </Shell>
          ) : (
            <Shell>
              <div className="proto-bar"><ErrorMessage message="This session could not be drawn: Cannot read properties of undefined (reading 'title')." onRetry={() => {}} action={{ label: "Reload window", onSelect: () => {} }} /></div>
              <Skeleton />
            </Shell>
          )
        )}
        {scene === "transcript" && (
          <Shell>
            {variant === 1 && (
              <div className="proto-center">
                <ErrorMessage message="The transcript could not be loaded." onRetry={() => {}} />
              </div>
            )}
            {variant === 2 && (
              <div className="proto-center proto-center--wide">
                <Block tone="danger" padding={4} className="proto-block">
                  <p className="proto-title">The transcript could not be loaded</p>
                  <p style={{ color: "var(--iv-text-muted)", fontSize: "var(--iv-text-sm)" }}>The server did not answer. Your messages are kept.</p>
                  <div className="proto-actions"><Button variant="secondary">Retry</Button></div>
                </Block>
                <span style={{ color: "var(--iv-text-faint)", fontSize: "var(--iv-text-xs)" }}>Or: “This session no longer exists.”</span>
              </div>
            )}
            {variant === 3 && (
              <>
                <div className="proto-bar"><ErrorMessage message="The transcript could not be loaded." onRetry={() => {}} /></div>
                <Skeleton />
              </>
            )}
          </Shell>
        )}
      </>
    )
  }
}

export const Plain = make(1)
export const Itemised = make(2)
export const InPlace = make(3)
