import { useAtom, useAtomSet } from "@effect/atom-react"
import { useRef } from "react"
import { Button } from "../../../core/components/button/button.tsx"
import { Dialog } from "../../../core/components/dialog/dialog.tsx"
import { archiveSessionAtom } from "../atoms/archive-session.ts"
import { deleteSessionAtom } from "../atoms/delete-session.ts"
import { sessionConfirmationAtom } from "../atoms/session-confirmation.ts"

export function SessionActionDialog() {
  const [pending, setPending] = useAtom(sessionConfirmationAtom)
  const archive = useAtomSet(archiveSessionAtom)
  const remove = useAtomSet(deleteSessionAtom)
  // The dialog keeps its text while it fades out.
  const shown = useRef(pending)
  if (pending !== null) shown.current = pending
  const session = shown.current?.session
  const close = () => setPending(null)
  const confirm = () => {
    if (!pending) return
    const target = { projectPath: pending.session.projectPath, sessionId: pending.session.id }
    if (pending.action === "archive") archive(target)
    else remove(target)
    close()
  }
  const text =
    shown.current?.action === "delete"
      ? {
          title: `Delete “${session?.title}”?`,
          description: "The session and its transcript are erased. This cannot be undone.",
          action: "Delete session",
        }
      : {
          title: "Archive the session and stop its agent?",
          description: `The agent of “${session?.title}” is still running. You can restore the session from Archived sessions.`,
          action: "Stop and archive",
        }
  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title={text.title}
      description={text.description}
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm}>
            {text.action}
          </Button>
        </>
      }
    />
  )
}
