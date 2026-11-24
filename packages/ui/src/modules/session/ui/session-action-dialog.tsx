import { useAtom, useAtomSet } from "@effect/atom-react"
import { useRef } from "react"
import { Button } from "../../../core/components/button/button.tsx"
import { Dialog } from "../../../core/components/dialog/dialog.tsx"
import { closeProjectAtom } from "../../project/atoms/close-project.ts"
import { archiveSessionAtom } from "../atoms/archive-session.ts"
import { deleteSessionAtom } from "../atoms/delete-session.ts"
import { sessionConfirmationAtom } from "../atoms/session-confirmation.ts"
import { confirmationText, type ConfirmationText } from "../rules/session-confirmation.ts"
import "./session-action-dialog.css"

const emptyText: ConfirmationText = { title: "", description: "", lists: [], confirm: "" }

export function SessionActionDialog() {
  const [pending, setPending] = useAtom(sessionConfirmationAtom)
  const archive = useAtomSet(archiveSessionAtom)
  const remove = useAtomSet(deleteSessionAtom)
  const closeProject = useAtomSet(closeProjectAtom)
  // The dialog keeps its text while it fades out.
  const shown = useRef(pending)
  if (pending !== null) shown.current = pending
  const close = () => setPending(null)
  const confirm = () => {
    if (!pending) return
    if (pending.action === "closeProject") closeProject(pending.project.path)
    else if (pending.action === "archiveAll" || pending.action === "deleteAll") {
      const run = pending.action === "archiveAll" ? archive : remove
      for (const { session } of pending.sessions)
        run({ projectPath: session.projectPath, sessionId: session.id })
    } else {
      const target = { projectPath: pending.session.projectPath, sessionId: pending.session.id }
      if (pending.action === "archive") archive(target)
      else remove(target)
    }
    close()
  }
  const text = shown.current === null ? emptyText : confirmationText(shown.current)
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
            {text.confirm}
          </Button>
        </>
      }
    >
      {text.lists.length > 0 && (
        <div className="iv-session-action-dialog__lists">
          {text.lists.map((list, index) => (
            <div key={index} className="iv-session-action-dialog__list">
              {list.label !== null && (
                <p className="iv-session-action-dialog__label">{list.label}</p>
              )}
              <ul
                className="iv-session-action-dialog__items"
                data-files={list.files || undefined}
                data-marked={list.files || list.label !== null || undefined}
              >
                {list.items.map((item, itemIndex) => (
                  <li key={`${itemIndex}:${item}`} className="iv-session-action-dialog__item">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  )
}
