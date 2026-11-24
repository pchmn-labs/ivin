import type { ChangeListError, DiscardFailure } from "@ivin/plugin-api/ui"

export const listError = (failure: DiscardFailure): ChangeListError => ({
  text: failure.text,
  detail: failure.gitMessage,
})
