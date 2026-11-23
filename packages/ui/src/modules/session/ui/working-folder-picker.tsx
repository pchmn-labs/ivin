import { useAtom, useAtomRefresh, useAtomValue } from "@effect/atom-react"
import type { Session, WorkingFolderChoice } from "@ivin/contracts/session"
import { AsyncResult } from "effect/reactivity"
import {
  ComposerMenu,
  type ComposerMenuGroup,
} from "../../../core/components/composer-menu/composer-menu.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { newWorktreeBaseOf, worktreesOf } from "../../worktree/atoms/list-worktrees.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { workingFolderChoiceOf } from "../atoms/working-folder-choice.ts"
import type { SessionLocationLabel } from "@ivin/plugin-api/ui"
import { folderName, newBranchLabel } from "../rules/session-location.ts"
import { CheckoutSync } from "./checkout-sync.tsx"
import { BranchPicker } from "./branch-picker.tsx"
import "./working-folder-picker.css"

export function WorkingFolderPicker({
  session,
  location,
}: {
  session: Session
  location: SessionLocationLabel
}) {
  const [choice, setChoice] = useAtom(workingFolderChoiceOf(session.id))
  const worktreesAtom = worktreesOf(session.projectPath)
  const worktrees = AsyncResult.getOrElse(useAtomValue(worktreesAtom), () => [])
  const refreshWorktrees = useAtomRefresh(worktreesAtom)
  const baseAtom = newWorktreeBaseOf(session.projectPath)
  const base = AsyncResult.getOrElse(useAtomValue(baseAtom), () => null)
  const refreshBase = useAtomRefresh(baseAtom)
  const sessions = useAtomValue(sessionsOf(session.projectPath).items)

  const usedBy = (path: string) =>
    sessions.find((other) => other.id !== session.id && other.workingFolder === path)?.title
  const groups: ComposerMenuGroup<WorkingFolderChoice>[] = [
    {
      items: [
        {
          value: { kind: "checkout" },
          key: "checkout",
          label: "Current checkout",
          icon: "folder",
          checked: choice.kind === "checkout",
        },
        {
          value: { kind: "new_worktree" },
          key: "new_worktree",
          label: "New worktree",
          icon: "plus",
          checked: choice.kind === "new_worktree",
        },
      ],
    },
  ]
  if (worktrees.length > 0) {
    groups.push({
      label: "Existing worktrees",
      items: worktrees.map((worktree) => {
        const hint = usedBy(worktree.path)
        return {
          value: { kind: "existing_worktree", path: worktree.path },
          key: worktree.path,
          label: worktree.branch ?? folderName(worktree.path),
          icon: "worktree",
          checked: choice.kind === "existing_worktree" && choice.path === worktree.path,
          ...(hint !== undefined && { hint }),
        }
      }),
    })
  }

  return (
    <span className="iv-working-folder-picker">
      <ComposerMenu
        label="Working folder"
        searchPlaceholder="Find a worktree…"
        noMatch={(query) => `No worktree matches “${query}”.`}
        groups={groups}
        onPick={setChoice}
        onOpenChange={(open) => {
          if (!open) return
          refreshWorktrees()
          refreshBase()
        }}
        trigger={
          <button
            type="button"
            className="iv-working-folder-picker__trigger"
            data-kind={location.kind}
            data-testid="working-folder-picker"
            aria-label={`Working folder: ${location.label}`}
          >
            <Icon name={location.kind === "worktree" ? "worktree" : "folder"} size={12} />
            {location.label}
            <Icon name="chevron-down" size={12} />
          </button>
        }
      />
      {location.branch !== null && choice.kind === "checkout" ? (
        <BranchPicker
          session={session}
          branch={location.branch}
          onPicked={(picked) =>
            setChoice(
              picked.workingFolder === picked.projectPath
                ? { kind: "checkout" }
                : { kind: "existing_worktree", path: picked.workingFolder },
            )
          }
        />
      ) : (
        <span className="iv-working-folder-picker__branch">
          <Icon name="git-branch" size={12} />
          {location.branch === null ? (
            newBranchLabel(base, session.branch)
          ) : (
            <span className="iv-working-folder-picker__name">{location.branch}</span>
          )}
        </span>
      )}
      {location.kind === "checkout" && <CheckoutSync session={session} />}
    </span>
  )
}
