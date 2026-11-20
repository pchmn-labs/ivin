import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { Session, WorkingFolderChoice } from "@ivin/contracts/session"
import type { ActionFailure } from "@ivin/plugin-api/ui"
import { Cause, Exit } from "effect"
import { AsyncResult } from "effect/reactivity"
import { useEffect, useRef, useState } from "react"
import { Button } from "../../../core/components/button/button.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Icon, type IconName } from "../../../core/components/icon/icon.tsx"
import { Stack } from "../../../core/components/stack/stack.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { newWorktreeBaseOf, worktreesOf } from "../../worktree/atoms/list-worktrees.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { pickWorkingFolderAtom } from "../atoms/pick-working-folder.ts"
import { pickWorkingFolderFailure } from "../rules/failure-message.ts"
import { folderName, newBranchLabel } from "../rules/session-location.ts"
import "./pick-working-folder.css"

interface Option {
  readonly id: string
  readonly choice: WorkingFolderChoice
  readonly icon: IconName
  readonly label: string
  readonly description: string
  readonly mono: boolean
}

export function PickWorkingFolder({ session }: { session: Session }) {
  const { projectPath } = session
  const worktreesAtom = worktreesOf(projectPath)
  const worktrees = AsyncResult.getOrElse(useAtomValue(worktreesAtom), () => [])
  const refreshWorktrees = useAtomRefresh(worktreesAtom)
  const base = AsyncResult.getOrElse(useAtomValue(newWorktreeBaseOf(projectPath)), () => null)
  const sessions = useAtomValue(sessionsOf(projectPath).items)
  const pick = useAtomSet(pickWorkingFolderAtom, { mode: "promiseExit" })
  const [chosen, setChosen] = useState("checkout")
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<ActionFailure | null>(null)
  const fieldset = useRef<HTMLFieldSetElement>(null)

  // The list was read when the project opened; worktrees may have come and gone since.
  useEffect(refreshWorktrees, [refreshWorktrees])
  useEffect(() => {
    fieldset.current?.querySelector<HTMLInputElement>("input:checked")?.focus()
  }, [])

  const usedBy = (path: string) =>
    sessions.find((other) => other.id !== session.id && other.workingFolder === path)?.title
  const fixed: Option[] = [
    {
      id: "checkout",
      choice: { kind: "checkout" },
      icon: "folder",
      label: "Current checkout",
      description: `In ${projectPath}, beside your own changes.`,
      mono: false,
    },
    {
      id: "new_worktree",
      choice: { kind: "new_worktree" },
      icon: "plus",
      label: "New worktree",
      description: `${newBranchLabel(base, null)}, under .worktrees/.`,
      mono: false,
    },
  ]
  const existing: Option[] = worktrees
    .filter((worktree) => worktree.path !== session.workingFolder)
    .map((worktree) => {
      const user = usedBy(worktree.path)
      return {
        id: worktree.path,
        choice: { kind: "existing_worktree", path: worktree.path },
        icon: "worktree",
        label: worktree.branch ?? folderName(worktree.path),
        description: user === undefined ? "No other session uses it." : `Shared with "${user}".`,
        mono: true,
      }
    })
  const selected = [...fixed, ...existing].find((option) => option.id === chosen) ?? fixed[0]!

  const submit = () => {
    if (pending) return
    setPending(true)
    setFailure(null)
    void pick({ projectPath, sessionId: session.id, workingFolder: selected.choice }).then(
      (exit) => {
        setPending(false)
        if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) return
        setFailure(pickWorkingFolderFailure(Cause.squash(exit.cause)))
      },
    )
  }

  const radio = (option: Option) => (
    <label
      key={option.id}
      className="iv-pick-working-folder__option"
      data-checked={option.id === selected.id || undefined}
    >
      <input
        type="radio"
        name={`working-folder-${session.id}`}
        className="iv-visually-hidden"
        checked={option.id === selected.id}
        disabled={pending}
        onChange={() => setChosen(option.id)}
      />
      <Icon name={option.icon} size={16} />
      <Stack gap={0}>
        <Text weight="medium" mono={option.mono} truncate title={option.label}>
          {option.label}
        </Text>
        <Text size="sm" tone="muted">
          {option.description}
        </Text>
      </Stack>
    </label>
  )

  return (
    <form
      className="iv-pick-working-folder"
      data-testid="pick-working-folder"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Stack gap={1}>
        <Text size="lg" weight="semibold">
          Where should the agent continue?
        </Text>
        <Text size="sm" tone="muted">
          This session's worktree was deleted. Its conversation is kept, and the agent resumes it in
          the folder you pick.
        </Text>
        <Text size="xs" tone="faint" mono truncate title={session.workingFolder}>
          {session.workingFolder}
        </Text>
      </Stack>
      <fieldset
        ref={fieldset}
        className="iv-pick-working-folder__options"
        onKeyDown={(event) => {
          if (event.key !== "Enter") return
          // A radio does not submit its form on Enter.
          event.preventDefault()
          submit()
        }}
      >
        <legend className="iv-visually-hidden">Working folder</legend>
        {fixed.map(radio)}
        {existing.length > 0 && (
          <Text size="xs" tone="faint" weight="medium">
            Existing worktrees
          </Text>
        )}
        {existing.map(radio)}
      </fieldset>
      {failure && (
        <div data-testid="pick-working-folder-alert">
          <ErrorMessage message={failure.text} {...(failure.retryable && { onRetry: submit })} />
        </div>
      )}
      <Stack direction="row" justify="end">
        <Button type="submit" variant="primary" disabled={pending}>
          {selected.choice.kind === "new_worktree" ? "Create and continue" : "Continue here"}
        </Button>
      </Stack>
    </form>
  )
}
