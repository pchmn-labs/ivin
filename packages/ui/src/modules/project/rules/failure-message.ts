import type { ActionFailure } from "@ivin/plugin-api/ui"

export const openProjectFailure = (_error: unknown): ActionFailure => ({
  text: "The folder was not opened.",
  retryable: true,
})

export const isNotTrusted = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "ProjectNotTrusted"
