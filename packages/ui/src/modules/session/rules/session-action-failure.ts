export type SessionAction = "archive" | "restore" | "delete"

// The actions that may ask the user first.
export type ConfirmedAction = Exclude<SessionAction, "restore">

const verb: Record<SessionAction, string> = {
  archive: "archived",
  restore: "restored",
  delete: "deleted",
}

export const sessionActionFailure = (action: SessionAction, error: unknown): string =>
  typeof error === "object" && error !== null && "_tag" in error && error._tag === "SessionNotFound"
    ? "This session no longer exists."
    : `The session was not ${verb[action]}.`
