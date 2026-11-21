import type { FolderEntry } from "@ivin/contracts/file"

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

export const sortEntries = (entries: ReadonlyArray<FolderEntry>): ReadonlyArray<FolderEntry> =>
  [...entries].sort((a, b) =>
    a.kind === b.kind ? byName.compare(a.name, b.name) : a.kind === "folder" ? -1 : 1,
  )
