import type { FolderEntry, TreeRow } from "@ivin/plugin-api/ui"

const childPath = (folder: string, name: string) => (folder === "" ? name : `${folder}/${name}`)

// The rows of the tree, from the listed folders: an open folder shows its children once listed.
export const treeRows = (
  listed: ReadonlyMap<string, ReadonlyArray<FolderEntry>>,
  open: ReadonlySet<string>,
): ReadonlyArray<TreeRow> => {
  const rows: TreeRow[] = []
  const add = (folder: string, depth: number) => {
    for (const entry of listed.get(folder) ?? []) {
      const path = childPath(folder, entry.name)
      if (entry.kind === "file") {
        rows.push({ id: path, name: entry.name, depth, expanded: null })
        continue
      }
      const expanded = open.has(path)
      rows.push({ id: path, name: entry.name, depth, expanded })
      if (expanded) add(path, depth + 1)
    }
  }
  add("", 0)
  return rows
}
