import { useAtom, useAtomRefresh, useAtomValue } from "@effect/atom-react"
import type { Session } from "@ivin/contracts/session"
import type { MenuItem } from "@ivin/plugin-api/ui"
import { AsyncResult } from "effect/reactivity"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { Menu } from "../../../core/components/menu/menu.tsx"
import { newWorktreeBaseOf, worktreesOf } from "../../worktree/atoms/list-worktrees.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { workingFolderChoiceOf } from "../atoms/working-folder-choice.ts"
import { folderName, newBranchLabel, type WorkingFolderLabel } from "../rules/session-location.ts"
import { BranchPicker } from "./branch-picker.tsx"
import "./working-folder-picker.css"

export function WorkingFolderPicker({
  session,
  location,
}: {
  session: Session
  location: WorkingFolderLabel
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
  const items: MenuItem[] = [
    {
      label: "Current checkout",
      icon: "folder",
      checked: choice.kind === "checkout",
      onSelect: () => setChoice({ kind: "checkout" }),
    },
    {
      label: "New worktree",
      icon: "plus",
      checked: choice.kind === "new_worktree",
      onSelect: () => setChoice({ kind: "new_worktree" }),
    },
  ]
  if (worktrees.length > 0) {
    items.push("separator", { heading: "Existing worktrees" })
    for (const worktree of worktrees) {
      const hint = usedBy(worktree.path)
      items.push({
        label: worktree.branch ?? folderName(worktree.path),
        icon: "worktree",
        checked: choice.kind === "existing_worktree" && choice.path === worktree.path,
        ...(hint !== undefined && { hint }),
        onSelect: () => setChoice({ kind: "existing_worktree", path: worktree.path }),
      })
    }
  }

  return (
    <span className="iv-working-folder-picker">
      <Menu
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
          >
            <Icon name={location.kind === "worktree" ? "worktree" : "folder"} size={12} />
            {location.label}
            <Icon name="chevron-down" size={12} />
          </button>
        }
        items={items}
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
    </span>
  )
}
