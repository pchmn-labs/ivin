import type { GitFileStatus, TreeRow } from "@ivin/plugin-api/ui"

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

interface Folder {
  readonly folders: Map<string, Folder>
  readonly files: Array<string>
}

const newFolder = (): Folder => ({ folders: new Map(), files: [] })

// The files whose name holds `query`, ignoring case, each under its folders, all open.
export const filterRows = (
  paths: ReadonlyArray<string>,
  query: string,
  statuses: ReadonlyMap<string, GitFileStatus>,
): ReadonlyArray<TreeRow> => {
  const needle = query.trim().toLowerCase()
  const root = newFolder()
  for (const path of paths) {
    const names = path.split("/")
    const name = names.pop() ?? ""
    if (!name.toLowerCase().includes(needle)) continue
    let folder = root
    for (const part of names) {
      let next = folder.folders.get(part)
      if (next === undefined) folder.folders.set(part, (next = newFolder()))
      folder = next
    }
    folder.files.push(name)
  }

  const rows: TreeRow[] = []
  const withStatus = (path: string) => {
    const status = statuses.get(path)
    return status === undefined ? {} : { status }
  }
  const add = (folder: Folder, prefix: string, depth: number) => {
    for (const name of [...folder.folders.keys()].sort(byName.compare)) {
      const path = prefix + name
      rows.push({ id: path, name, depth, expanded: true, ...withStatus(path) })
      add(folder.folders.get(name) ?? newFolder(), `${path}/`, depth + 1)
    }
    for (const name of folder.files.sort(byName.compare)) {
      const path = prefix + name
      const start = name.toLowerCase().indexOf(needle)
      rows.push({
        id: path,
        name,
        depth,
        expanded: null,
        match: [start, start + needle.length],
        ...withStatus(path),
      })
    }
  }
  add(root, "", 0)
  return rows
}
