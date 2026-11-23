import { Effect } from "effect"

export const contentVersion = (bytes: Uint8Array) =>
  Effect.promise(async () => {
    const digest = await crypto.subtle.digest("SHA-256", bytes)
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  })
