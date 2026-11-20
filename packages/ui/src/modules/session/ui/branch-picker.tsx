import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import { Combobox } from "@base-ui/react/combobox"
import type { Session } from "@ivin/contracts/session"
import type { Branch } from "@ivin/contracts/worktree"
import { Cause, Exit } from "effect"
import { AsyncResult } from "effect/reactivity"
import { useState } from "react"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { branchesOf } from "../../worktree/atoms/list-branches.ts"
import { pickBranchAtom } from "../atoms/pick-branch.ts"
import { branchMark, pickPreview } from "../rules/branch-pick.ts"
import { pickBranchFailure } from "../rules/failure-message.ts"
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
  const [query, setQuery] = useState("")
  const [highlighted, setHighlighted] = useState<Branch | undefined>(undefined)
  const [picking, setPicking] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const branchesAtom = branchesOf(session.projectPath)
  const listed = useAtomValue(branchesAtom)
  const refresh = useAtomRefresh(branchesAtom)
  const pickBranch = useAtomSet(pickBranchAtom, { mode: "promiseExit" })

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

  return (
    <Combobox.Root<Branch>
      items={branches}
      value={null}
      itemToStringLabel={(b) => b.name}
      isItemEqualToValue={(a, b) => a.name === b.name && a.remote === b.remote}
      autoHighlight
      open={open}
      onOpenChange={(next, details) => {
        // The popup stays open until the pick lands, so a refusal shows where the user picked.
        if (!next && details.reason === "item-press") return
        setOpen(next)
        if (next) {
          setQuery("")
          setFailure(null)
          refresh()
        }
      }}
      inputValue={query}
      onInputValueChange={(value, details) => {
        if (details.reason === "input-change" || details.reason === "input-clear") setQuery(value)
      }}
      onValueChange={(picked) => {
        if (picked && !picking) void pick(picked)
      }}
      onItemHighlighted={(b) => setHighlighted(b)}
    >
      <Combobox.Trigger
        className="iv-branch-picker__trigger"
        data-testid="branch-picker"
        disabled={isRunning(session.status) || session.status === "preparing_worktree"}
        aria-label={`Branch ${branch}. Switch branch`}
      >
        <Icon name={picking ? "loader" : "git-branch"} size={12} />
        <span className="iv-branch-picker__name">{branch}</span>
        <Icon name="chevron-down" size={12} />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" side="top" sideOffset={4}>
          <Combobox.Popup className="iv-branch-picker" aria-label="Switch branch">
            <div className="iv-branch-picker__search">
              <Icon name="search" size={14} />
              <Combobox.Input
                className="iv-branch-picker__input"
                placeholder="Switch to a branch…"
                aria-label="Branch"
                spellCheck={false}
              />
              {fetch === "fetching" && hasRemote && (
                <span className="iv-branch-picker__fetching">
                  <Icon name="loader" size={12} />
                  Fetching
                </span>
              )}
            </div>
            <div className="iv-branch-picker__viewport">
              <Combobox.Empty>
                {query.trim() !== "" && (
                  <div className="iv-branch-picker__note">No branch matches “{query.trim()}”.</div>
                )}
              </Combobox.Empty>
              <Combobox.List className="iv-branch-picker__list">
                {(b: Branch) => (
                  <BranchRow key={`${b.remote}:${b.name}`} branch={b} session={session} />
                )}
              </Combobox.List>
              {!hasRemote && query.trim() === "" && fetch === "fetching" && (
                <div className="iv-branch-picker__note" role="status">
                  <Icon name="loader" size={12} />
                  Fetching remote branches…
                </div>
              )}
              {fetch === "failed" && query.trim() === "" && (
                <div className="iv-branch-picker__note" role="status">
                  Could not fetch origin: its branches are as last fetched.
                </div>
              )}
            </div>
            {failure && (
              <div className="iv-branch-picker__failure">
                <ErrorMessage message={failure.text} />
                {failure.gitMessage !== null && (
                  <pre className="iv-branch-picker__git" data-testid="branch-picker-git-message">
                    {failure.gitMessage}
                  </pre>
                )}
              </div>
            )}
            <div className="iv-branch-picker__foot">
              <span className="iv-branch-picker__preview">
                {highlighted ? pickPreview(highlighted, branches, session) : ""}
              </span>
              <span className="iv-branch-picker__keys">↵ switch · esc</span>
            </div>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

function BranchRow({ branch, session }: { branch: Branch; session: Session }) {
  const mark = branchMark(branch, session)
  const held = mark === "checkout" || mark === "worktree"
  return (
    <Combobox.Item
      value={branch}
      className="iv-branch-picker__item"
      data-remote={branch.remote || undefined}
      data-mark={mark ?? undefined}
      data-testid="branch-row"
    >
      <span className="iv-branch-picker__icon">
        <Icon
          name={mark === "worktree" ? "worktree" : mark === "checkout" ? "folder" : "git-branch"}
          size={14}
        />
      </span>
      <span className="iv-branch-picker__label">
        {branch.remote ? (
          <>
            <span className="iv-branch-picker__prefix">origin/</span>
            {branch.name.slice("origin/".length)}
          </>
        ) : (
          branch.name
        )}
      </span>
      {held && <span className="iv-branch-picker__tag">{MARK_TAGS[mark]}</span>}
      {mark === "current" && (
        <span className="iv-branch-picker__check" aria-label="Current branch">
          <Icon name="check" size={14} />
        </span>
      )}
    </Combobox.Item>
  )
}
