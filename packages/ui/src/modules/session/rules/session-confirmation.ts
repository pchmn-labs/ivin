import type { Session } from "@ivin/contracts/session"
import { fileName } from "../../file/rules/file-name.ts"
import { isAgentBusy } from "./is-running.ts"

export type ActionOnAll = "archiveAll" | "deleteAll"

interface ConfirmationOfAll<Action extends ActionOnAll> {
  readonly action: Action
  readonly sessions: ReadonlyArray<{
    readonly session: Session
    readonly unsaved: ReadonlyArray<string>
  }>
}

export type Confirmation =
  | {
      readonly action: "archive" | "delete"
      readonly session: Session
      readonly unsaved: ReadonlyArray<string>
    }
  | {
      readonly action: "closeProject"
      readonly project: { readonly path: string; readonly name: string }
      readonly sessions: ReadonlyArray<{
        readonly title: string
        readonly unsaved: ReadonlyArray<string>
      }>
    }
  // One member per action, so that ruling one out narrows the type.
  | ConfirmationOfAll<"archiveAll">
  | ConfirmationOfAll<"deleteAll">

export interface ConfirmationList {
  readonly label: string | null
  readonly items: ReadonlyArray<string>
  readonly files: boolean
}

export interface ConfirmationText {
  readonly title: string
  readonly description: string
  readonly lists: ReadonlyArray<ConfirmationList>
  readonly confirm: string
}

const titledUnsaved = (
  confirmation: Confirmation,
): ReadonlyArray<{ readonly title: string; readonly unsaved: ReadonlyArray<string> }> => {
  switch (confirmation.action) {
    case "closeProject":
      return confirmation.sessions
    case "archiveAll":
    case "deleteAll":
      return confirmation.sessions.map(({ session, unsaved }) => ({
        title: session.title,
        unsaved,
      }))
    default:
      return [{ title: confirmation.session.title, unsaved: confirmation.unsaved }]
  }
}

export const needsConfirmation = (confirmation: Confirmation): boolean => {
  if (confirmation.action !== "archive")
    return (
      confirmation.action !== "closeProject" ||
      titledUnsaved(confirmation).some((s) => s.unsaved.length > 0)
    )
  return confirmation.unsaved.length > 0 || isAgentBusy(confirmation.session.status)
}

// Each file carries its session's title once several sessions have edits.
const unsavedNames = (confirmation: Confirmation): ReadonlyArray<string> => {
  const edited = titledUnsaved(confirmation).filter((session) => session.unsaved.length > 0)
  return edited.flatMap((session) =>
    session.unsaved.map((path) =>
      edited.length > 1 ? `${fileName(path)} (${session.title})` : fileName(path),
    ),
  )
}

const fileList = (
  files: ReadonlyArray<string>,
  label: string | null,
): ReadonlyArray<ConfirmationList> =>
  files.length === 0 ? [] : [{ label, items: files, files: true }]

const allText = (
  action: ActionOnAll,
  sessions: ReadonlyArray<{ readonly session: Session }>,
  files: ReadonlyArray<string>,
): ConfirmationText => {
  const one = sessions.length === 1
  const titles = sessions.map(({ session }) => session.title)
  const running = sessions
    .filter(({ session }) => isAgentBusy(session.status))
    .map(({ session }) => session.title)
  const lists: ReadonlyArray<ConfirmationList> = [
    ...(action === "deleteAll" ? [{ label: null, items: titles, files: false }] : []),
    ...(running.length === 0
      ? []
      : [
          {
            label:
              running.length === 1
                ? "This agent is still running and stops:"
                : "These agents are still running and stop:",
            items: running,
            files: false,
          },
        ]),
    ...fileList(files, "The unsaved edits to these files are lost:"),
  ]
  const edits = files.length > 0
  const count = `${sessions.length} inactive session${one ? "" : "s"}`
  if (action === "deleteAll") {
    return {
      title: `Delete ${count}?`,
      description: one
        ? "The session and its transcript are erased. This cannot be undone."
        : "The sessions and their transcripts are erased. This cannot be undone.",
      lists,
      confirm: edits ? "Delete all and lose edits" : "Delete all",
    }
  }
  return {
    title: `Archive ${count}?`,
    description: `You can restore ${one ? "it" : "them"} from Archived sessions.`,
    lists,
    confirm: edits
      ? "Archive all and lose edits"
      : running.length > 0
        ? "Stop and archive all"
        : "Archive all",
  }
}

export const confirmationText = (confirmation: Confirmation): ConfirmationText => {
  const files = unsavedNames(confirmation)
  const edits = files.length > 0
  if (confirmation.action === "archiveAll" || confirmation.action === "deleteAll")
    return allText(confirmation.action, confirmation.sessions, files)
  if (confirmation.action === "closeProject") {
    return {
      title: `Close “${confirmation.project.name}”?`,
      description: "Closing this project will lose the unsaved edits to these files:",
      lists: fileList(files, null),
      confirm: "Close project and lose edits",
    }
  }
  const running = isAgentBusy(confirmation.session.status)
  const title = confirmation.session.title
  if (confirmation.action === "delete") {
    const effects = [
      ...(running ? ["stop the working agent"] : []),
      "lose the unsaved edits to these files",
    ]
    return {
      title: `Delete “${title}”?`,
      description: edits
        ? `Deleting this session will ${effects.join(" and ")}:`
        : "The session and its transcript are erased. This cannot be undone.",
      lists: fileList(files, null),
      confirm: edits ? "Delete and lose edits" : "Delete session",
    }
  }
  if (!edits) {
    return {
      title: "Archive the session and stop its agent?",
      description: `The agent of “${title}” is still running. You can restore the session from Archived sessions.`,
      lists: fileList(files, null),
      confirm: "Stop and archive",
    }
  }
  return {
    title: `Archive “${title}”?`,
    description: running
      ? "Archiving this session will stop the working agent and lose the unsaved edits to these files:"
      : "Archiving this session will lose the unsaved edits to these files:",
    lists: fileList(files, null),
    confirm: running ? "Stop and archive" : "Archive and lose edits",
  }
}
