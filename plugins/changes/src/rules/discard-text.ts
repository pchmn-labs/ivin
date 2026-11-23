import type { Change } from "@ivin/plugin-api/ui"

const deletes = (change: Change) => change.status === "untracked" || change.status === "added"

export const discardText = (change: Change) => {
  const name = change.path.slice(change.path.lastIndexOf("/") + 1)
  if (!deletes(change))
    return {
      title: `Discard the changes to “${name}”?`,
      description: "The file goes back to its last commit. This cannot be undone.",
      action: "Discard changes",
    }
  return {
    title: `Delete “${name}”?`,
    description:
      change.status === "untracked"
        ? "Git does not track this file, so discarding its changes deletes it. This cannot be undone."
        : "The file is new since the last commit, so discarding its changes deletes it. This cannot be undone.",
    action: "Delete file",
  }
}

const files = (count: number) => (count === 1 ? "1 file" : `${count} files`)

export const discardAllText = (changes: ReadonlyArray<Change>) => {
  const deleted = changes.filter(deletes).length
  const restored = changes.length - deleted
  const parts = [
    restored > 0 &&
      `${files(restored)} ${restored === 1 ? "goes back to its" : "go back to their"} last commit`,
    deleted > 0 && `${deleted === 1 ? "1 new file is" : `${deleted} new files are`} deleted`,
  ].filter((part) => part !== false)
  return {
    title: "Discard all uncommitted changes?",
    description: `${parts.join(", and ")}. This cannot be undone.`.replace(/^./, (c) =>
      c.toUpperCase(),
    ),
    action: "Discard all",
  }
}
