import type { Session } from "@ivin/contracts/session"
import { fileName } from "../../file/rules/file-name.ts"
import { isRunning } from "./is-running.ts"

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

const unsavedPathsOfConfirmation = (confirmation: Confirmation): ReadonlyArray<string> =>
  confirmation.action === "closeProject"
    ? confirmation.sessions.flatMap((session) => session.unsaved)
    : confirmation.unsaved

export const needsConfirmation = (confirmation: Confirmation): boolean => {
  if (unsavedPathsOfConfirmation(confirmation).length > 0 || confirmation.action === "delete")
    return true
  return confirmation.action === "archive" && isRunning(confirmation.session.status)
}

// A project's files carry their session's title once several sessions have edits.
const unsavedNames = (confirmation: Confirmation): ReadonlyArray<string> => {
  if (confirmation.action !== "closeProject") return confirmation.unsaved.map(fileName)
  const edited = confirmation.sessions.filter((session) => session.unsaved.length > 0)
  return edited.flatMap((session) =>
    session.unsaved.map((path) =>
      edited.length > 1 ? `${fileName(path)} (${session.title})` : fileName(path),
    ),
  )
}

export const confirmationText = (
  confirmation: Confirmation,
): {
  title: string
  description: string
  files: ReadonlyArray<string>
  confirm: string
} => {
  const files = unsavedNames(confirmation)
  const edits = files.length > 0
  if (confirmation.action === "closeProject") {
    return {
      title: `Close “${confirmation.project.name}”?`,
      description: "Closing this project will lose the unsaved edits to these files:",
      files,
      confirm: "Close project and lose edits",
    }
  }
  const running = isRunning(confirmation.session.status)
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
      files,
      confirm: edits ? "Delete and lose edits" : "Delete session",
    }
  }
  if (!edits) {
    return {
      title: "Archive the session and stop its agent?",
      description: `The agent of “${title}” is still running. You can restore the session from Archived sessions.`,
      files,
      confirm: "Stop and archive",
    }
  }
  return {
    title: `Archive “${title}”?`,
    description: running
      ? "Archiving this session will stop the working agent and lose the unsaved edits to these files:"
      : "Archiving this session will lose the unsaved edits to these files:",
    files,
    confirm: running ? "Stop and archive" : "Archive and lose edits",
  }
}
