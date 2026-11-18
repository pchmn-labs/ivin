import type { ActionFailure } from "@ivin/plugin-api/ui"

export const openProjectFailure = (_error: unknown): ActionFailure => ({
  text: "The folder was not opened.",
  retryable: true,
})
