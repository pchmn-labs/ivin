import type { Draft, Session } from "@ivin/plugin-api/ui"

export const withRelaunchMessage = (draft: Draft, failure: { readonly message: string }): Draft =>
  draft.text === "" ? { ...draft, text: failure.message } : draft

export const pendingText = (message: Session["pendingMessages"][number]) =>
  message.text || message.images.map((image) => `[Image #${image.number}]`).join(" ")
