import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { Session } from "@ivin/contracts/session"
import type { Branch } from "@ivin/contracts/worktree"
import { Cause, Exit } from "effect"
import { AsyncResult } from "effect/reactivity"
import { useState } from "react"
import {
  ComposerMenu,
  ComposerMenuNote,
  type ComposerMenuItem,
} from "../../../core/components/composer-menu/composer-menu.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { KeyHints } from "../../../core/components/key-hints/key-hints.tsx"
import { branchesOf } from "../../worktree/atoms/list-branches.ts"
import { pickBranchAtom } from "../atoms/pick-branch.ts"
import { branchMark, pickPreview } from "../rules/branch-pick.ts"
import { listBranchesFailure, pickBranchFailure } from "../rules/failure-message.ts"
import { isRunning } from "../rules/is-running.ts"
import "./branch-picker.css"

const MARK_TAGS = { checkout: "in checkout", worktree: "in worktree" } as const

type Failure = ReturnType<typeof pickBranchFailure>

export function BranchPicker({
  session,
  branch,
  onPicked,
}: {
  session: Session
  branch: string
  onPicked?: (session: Session) => void
}) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState<Branch | undefined>(undefined)
  const [picking, setPicking] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const branchesAtom = branchesOf(session.projectPath)
  const listed = useAtomValue(branchesAtom)
  const refresh = useAtomRefresh(branchesAtom)
  const pickBranch = useAtomSet(pickBranchAtom, { mode: "promiseExit" })

  const listFailure = AsyncResult.isFailure(listed)
    ? listBranchesFailure(Cause.squash(listed.cause))
    : null
  const shownFailure = failure ?? listFailure
  const list = AsyncResult.getOrElse(listed, () => null)
  const branches = list?.branches ?? []
  const fetch = list?.fetch ?? "fetching"
  const hasRemote = branches.some((b) => b.remote)

  const pick = async (picked: Branch) => {
    setPicking(true)
    setFailure(null)
    const exit = await pickBranch({
      projectPath: session.projectPath,
      sessionId: session.id,
      name: picked.name,
      remote: picked.remote,
    })
    setPicking(false)
    if (Exit.isSuccess(exit)) {
      setOpen(false)
      onPicked?.(exit.value)
    } else if (!Cause.hasInterruptsOnly(exit.cause)) {
      setFailure(pickBranchFailure(Cause.squash(exit.cause), picked.name))
    }
  }

  const items: ComposerMenuItem<Branch>[] = branches.map((b) => {
    const mark = branchMark(b, session)
    const held = mark === "checkout" || mark === "worktree"
    return {
      value: b,
      key: `${b.remote}:${b.name}`,
      label: b.name,
      ...(b.remote && { prefix: "origin/", muted: true }),
      icon: mark === "worktree" ? "worktree" : mark === "checkout" ? "folder" : "git-branch",
      accent: held,
      mono: true,
      ...(held && { tag: MARK_TAGS[mark] }),
      ...(mark === "current" && { checked: true }),
      testId: "branch-row",
    }
  })

  return (
    <ComposerMenu
      label="Switch branch"
      searchPlaceholder="Switch to a branch…"
      noMatch={(query) => `No branch matches “${query}”.`}
      groups={[{ items }]}
      open={open}
      // The menu stays open until the pick lands, so a refusal shows where the user picked.
      keepOpenOnPick
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setFailure(null)
          refresh()
        }
      }}
      onPick={(picked) => {
        if (!picking) void pick(picked)
      }}
      onHighlight={setHighlighted}
      checkedLabel="Current branch"
      disabled={isRunning(session.status) || session.status === "preparing_worktree"}
      trigger={
        <button
          type="button"
          className="iv-branch-picker__trigger"
          data-testid="branch-picker"
          aria-label={`Branch ${branch}. Switch branch`}
        >
          <Icon name={picking ? "loader" : "git-branch"} size={12} />
          <span className="iv-branch-picker__name">{branch}</span>
          <Icon name="chevron-down" size={12} />
        </button>
      }
      searchStatus={
        fetch === "fetching" &&
        hasRemote && (
          <span className="iv-branch-picker__fetching">
            <Icon name="loader" size={12} />
            Fetching
          </span>
        )
      }
      status={(query) => (
        <>
          {!hasRemote && query === "" && fetch === "fetching" && (
            <ComposerMenuNote>
              <Icon name="loader" size={12} />
              Fetching remote branches…
            </ComposerMenuNote>
          )}
          {fetch === "failed" && query === "" && (
            <ComposerMenuNote>
              Could not fetch origin: its branches are as last fetched.
            </ComposerMenuNote>
          )}
        </>
      )}
    >
      {shownFailure && (
        <div className="iv-branch-picker__failure">
          <ErrorMessage
            message={shownFailure.text}
            {...(failure === null && { onRetry: refresh })}
          />
          {shownFailure.gitMessage !== null && (
            <pre className="iv-branch-picker__git" data-testid="branch-picker-git-message">
              {shownFailure.gitMessage}
            </pre>
          )}
        </div>
      )}
      <div className="iv-branch-picker__foot">
        <span className="iv-branch-picker__preview">
          {highlighted
            ? pickPreview(highlighted, branches, session)
            : `On ${branch}. Pick a branch to switch to it.`}
        </span>
        <KeyHints
          hints={[
            { key: "↵", label: "Switch" },
            { key: "Esc", label: "Close" },
          ]}
        />
      </div>
    </ComposerMenu>
  )
}
