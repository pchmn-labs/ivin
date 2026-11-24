import { useAtomValue } from "@effect/atom-react"
import { PreviewCard } from "@base-ui/react/preview-card"
import { useState } from "react"
import type { UpdateState } from "@ivin/contracts/update"
import { Button } from "../../../core/components/button/button.tsx"
import { Dialog } from "../../../core/components/dialog/dialog.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import type { IconName } from "../../../core/components/icon/icon.tsx"
import { Markdown } from "../../../core/components/markdown/markdown.tsx"
import { isAgentBusy } from "../../session/rules/is-running.ts"
import { openSessionsAtom } from "../../session/atoms/open-sessions.ts"
import { checkForUpdates, restartToUpdate } from "../adapters/desktop-update.ts"
import { updateStateAtom } from "../atoms/update-state.ts"
import { failureMessage, restartPrompt } from "../rules/update-message.ts"
import "./update-button.css"

const iconOf = (state: UpdateState): IconName =>
  state.kind === "checking"
    ? "loader"
    : state.kind === "ready"
      ? "restart"
      : state.kind === "failed"
        ? "triangle-alert"
        : "download"

const labelOf = (state: UpdateState): string => {
  switch (state.kind) {
    case "checking":
      return "Checking for updates…"
    case "downloading":
      return `Downloading ivin ${state.version}…`
    case "ready":
      return "Restart to update"
    case "failed":
      return "Update failed"
    case "idle":
      return ""
  }
}

function Card({ state, onRetry }: { state: UpdateState; onRetry: () => void }) {
  if (state.kind === "failed") {
    return <ErrorMessage message={failureMessage(state.reason)} onRetry={onRetry} />
  }
  if (state.kind === "checking") return <p className="iv-update-card__title">{labelOf(state)}</p>
  if (state.kind !== "ready" && state.kind !== "downloading") return null
  return (
    <>
      <p className="iv-update-card__title">
        {state.kind === "ready"
          ? `ivin ${state.version} is ready. Restart to update.`
          : `Downloading ivin ${state.version} (${state.percent}%)`}
      </p>
      {state.notes !== "" && (
        <div className="iv-update-card__notes">
          <p className="iv-update-card__heading">What's changed</p>
          <Markdown text={state.notes} />
        </div>
      )}
      <a className="iv-update-card__link" href={state.url} target="_blank" rel="noreferrer">
        View release on GitHub
        <Icon name="external-link" size={12} />
      </a>
    </>
  )
}

export function UpdateButton() {
  const state = useAtomValue(updateStateAtom)
  const sessions = useAtomValue(openSessionsAtom)
  const [confirming, setConfirming] = useState(false)
  if (state === null || state.kind === "idle") return null

  const running = sessions.filter((session) => isAgentBusy(session.status))
  const retry = () => void checkForUpdates()
  const onClick = () => {
    if (state.kind === "failed") return retry()
    if (state.kind !== "ready") return
    if (restartPrompt(state.version, running.length) === null) return void restartToUpdate()
    setConfirming(true)
  }
  const prompt = state.kind === "ready" ? restartPrompt(state.version, running.length) : null
  return (
    <>
      <PreviewCard.Root>
        <PreviewCard.Trigger
          delay={300}
          render={
            <button
              type="button"
              className="iv-button iv-button--icon iv-button--ghost iv-button--sm iv-update-button"
              data-kind={state.kind}
              aria-label={labelOf(state)}
              onClick={onClick}
            />
          }
        >
          <Icon name={iconOf(state)} size={14} />
          {(state.kind === "ready" || state.kind === "failed") && (
            <span className="iv-update-button__dot" aria-hidden="true" />
          )}
        </PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={8}>
            <PreviewCard.Popup className="iv-update-card">
              <Card state={state} onRetry={retry} />
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
      <Dialog
        open={confirming && prompt !== null}
        onOpenChange={setConfirming}
        title={prompt?.title ?? ""}
        description={prompt?.description ?? ""}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirming(false)
                void restartToUpdate()
              }}
            >
              Restart and update
            </Button>
          </>
        }
      >
        <ul className="iv-update-agents">
          {running.map((session) => (
            <li key={session.id}>{session.title}</li>
          ))}
        </ul>
      </Dialog>
    </>
  )
}
