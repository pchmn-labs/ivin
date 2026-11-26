import type { ActionFailure } from "@ivin/plugin-api/ui"

export const openProjectFailure = (error: unknown): ActionFailure =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "WorkspaceUnreadable"
    ? { text: "The workspace file could not be read, or lists no folder.", retryable: true }
    : { text: "The folder was not opened.", retryable: true }

export const isNotTrusted = (
  error: unknown,
): error is { readonly _tag: "ProjectNotTrusted"; readonly folders?: ReadonlyArray<string> } =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "ProjectNotTrusted"
