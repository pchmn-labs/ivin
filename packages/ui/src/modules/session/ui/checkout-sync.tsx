import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { LocalChangesChoice, Session } from "@ivin/contracts/session"
import { Cause, Exit } from "effect"
import { AsyncResult } from "effect/reactivity"
import { useState } from "react"
import { Button } from "../../../core/components/button/button.tsx"
import { CodeBlock } from "../../../core/components/code-block/code-block.tsx"
import { Dialog } from "../../../core/components/dialog/dialog.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { TextField } from "../../../core/components/text-field/text-field.tsx"
import { Tooltip } from "../../../core/components/tooltip/tooltip.tsx"
import { errorTag } from "../../../shared/rules/error-tag.ts"
import { checkoutStatusOf } from "../../worktree/atoms/checkout-status.ts"
import { fastForwardAtom } from "../atoms/fast-forward.ts"
import { switchToDefaultBranchAtom } from "../atoms/switch-to-default-branch.ts"
import {
  type CheckoutAction,
  type CheckoutFailure,
  checkoutFailure,
} from "../rules/failure-message.ts"
import "./checkout-sync.css"

const ACTIONS: Record<CheckoutAction, { readonly failed: string; readonly stashAndRetry: string }> =
  {
    switch: { failed: "Switch failed", stashAndRetry: "Stash & switch" },
    fastForward: { failed: "Pull failed", stashAndRetry: "Stash & pull" },
  }

export function CheckoutSync({ session }: { session: Session }) {
  const statusAtom = checkoutStatusOf(session.projectPath)
  const status = AsyncResult.getOrElse(useAtomValue(statusAtom), () => null)
  const refreshStatus = useAtomRefresh(statusAtom)
  const switchToDefault = useAtomSet(switchToDefaultBranchAtom, { mode: "promiseExit" })
  const fastForward = useAtomSet(fastForwardAtom, { mode: "promiseExit" })
  const [busy, setBusy] = useState<CheckoutAction | null>(null)
  const [askingLocalChanges, setAskingLocalChanges] = useState(false)
  const [commitMessage, setCommitMessage] = useState("")
  const [failure, setFailure] = useState<(CheckoutFailure & { action: CheckoutAction }) | null>(
    null,
  )

  const run = async (
    action: CheckoutAction,
    attempt: () => Promise<Exit.Exit<Session, unknown>>,
  ) => {
    setFailure(null)
    setBusy(action)
    const exit = await attempt()
    setBusy(null)
    refreshStatus()
    if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) return
    const error = Cause.squash(exit.cause)
    if (errorTag(error) === "CheckoutHasLocalChanges") return setAskingLocalChanges(true)
    setFailure({ action, ...checkoutFailure(error, action) })
  }
  const ids = { projectPath: session.projectPath, sessionId: session.id }
  const doSwitch = (localChanges?: LocalChangesChoice) => {
    setAskingLocalChanges(false)
    void run("switch", () => switchToDefault({ ...ids, ...(localChanges && { localChanges }) }))
  }
  const doFastForward = (stash = false) =>
    void run("fastForward", () => fastForward({ ...ids, stash }))
  const retry = (action: CheckoutAction, stash: boolean) => {
    if (action === "fastForward") doFastForward(stash)
    else doSwitch(stash ? { kind: "stash" } : undefined)
  }
  const commit = () => {
    if (commitMessage.trim() !== "") doSwitch({ kind: "commit", message: commitMessage })
  }

  if (status === null) return null
  const canSwitch =
    status.defaultBranch !== null &&
    status.branch !== status.defaultBranch &&
    !status.defaultBranchInWorktree
  const pullLabel = `Pull ${status.behind} ${status.behind === 1 ? "commit" : "commits"} from origin/${status.branch}`

  return (
    <>
      {status.behind > 0 && (
        <Tooltip content={pullLabel}>
          <button
            type="button"
            className="iv-checkout-sync__button iv-checkout-sync__button--count"
            aria-label={pullLabel}
            disabled={busy !== null}
            onClick={() => doFastForward()}
          >
            <Icon name={busy === "fastForward" ? "loader" : "arrow-down"} size={12} />
            {status.behind}
          </button>
        </Tooltip>
      )}
      {canSwitch && (
        <button
          type="button"
          className="iv-checkout-sync__button"
          disabled={busy !== null}
          onClick={() => doSwitch()}
        >
          <Icon name={busy === "switch" ? "loader" : "arrows-left-right"} size={12} />
          Switch to {status.defaultBranch}
        </button>
      )}
      <Dialog
        open={askingLocalChanges}
        onOpenChange={setAskingLocalChanges}
        title="Uncommitted changes"
        description={`${status.branch ?? "The checkout"} has changes that are not committed. Put them aside before switching to ${status.defaultBranch}: a stash keeps them in git stash list.`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setAskingLocalChanges(false)}>
              Cancel
            </Button>
            <Button disabled={commitMessage.trim() === ""} onClick={commit}>
              Commit &amp; switch
            </Button>
            <Button variant="primary" onClick={() => doSwitch({ kind: "stash" })}>
              Stash &amp; switch
            </Button>
          </>
        }
      >
        <TextField
          label="Commit message, to commit them instead"
          showLabel
          placeholder="WIP"
          value={commitMessage}
          onChange={(event) => setCommitMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            commit()
          }}
        />
      </Dialog>
      <Dialog
        open={failure !== null}
        onOpenChange={(open) => {
          if (!open) setFailure(null)
        }}
        title={failure ? ACTIONS[failure.action].failed : ""}
        {...(failure && { description: failure.text })}
        actions={
          failure && (
            <>
              <Button variant="ghost" onClick={() => setFailure(null)}>
                Close
              </Button>
              {(failure.blockedByLocalChanges || failure.retryable) && (
                <Button
                  variant="primary"
                  onClick={() => retry(failure.action, failure.blockedByLocalChanges)}
                >
                  {failure.blockedByLocalChanges ? ACTIONS[failure.action].stashAndRetry : "Retry"}
                </Button>
              )}
            </>
          )
        }
      >
        {failure?.gitMessage != null && <CodeBlock text={failure.gitMessage} />}
      </Dialog>
    </>
  )
}
