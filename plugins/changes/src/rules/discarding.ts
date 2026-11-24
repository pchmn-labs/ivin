import type { Change } from "@ivin/plugin-api/ui"

// The changes the dialog asks to discard, as they were when it opened.
export interface Discarding {
  readonly all: boolean
  readonly changes: ReadonlyArray<Change>
}
