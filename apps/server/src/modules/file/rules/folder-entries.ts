const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

export const sortEntries = <T extends { readonly name: string; readonly kind: "folder" | "file" }>(
  entries: ReadonlyArray<T>,
): ReadonlyArray<T> =>
  [...entries].sort((a, b) =>
    a.kind === b.kind ? byName.compare(a.name, b.name) : a.kind === "folder" ? -1 : 1,
  )
