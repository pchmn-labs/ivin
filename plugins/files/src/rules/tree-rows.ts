import type { FolderEntry, GitFileStatus, TreeRow, TreeRowStatus } from "@ivin/plugin-api/ui"

export const childPath = (folder: string, name: string) =>
  folder === "" ? name : `${folder}/${name}`

export const treeRows = (
  listed: ReadonlyMap<string, ReadonlyArray<FolderEntry>>,
  open: ReadonlySet<string>,
  {
    showIgnored,
    statuses,
  }: { readonly showIgnored: boolean; readonly statuses: ReadonlyMap<string, GitFileStatus> },
): ReadonlyArray<TreeRow> => {
  const rows: TreeRow[] = []
  const add = (folder: string, depth: number) => {
    for (const entry of listed.get(folder) ?? []) {
      if (entry.ignored && !showIgnored) continue
      const path = childPath(folder, entry.name)
      const status: TreeRowStatus | undefined = entry.ignored ? "ignored" : statuses.get(path)
      const row = { id: path, name: entry.name, depth, ...(status !== undefined && { status }) }
      if (entry.kind === "file") {
        rows.push({ ...row, expanded: null })
        continue
      }
      const expanded = open.has(path)
      rows.push({ ...row, expanded })
      if (expanded) add(path, depth + 1)
    }
  }
  add("", 0)
  return rows
}
