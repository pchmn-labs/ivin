import type { FolderListing } from "@ivin/plugin-api/ui"

export type FolderState = { readonly kind: "loading" } | FolderListing

export interface FolderTree {
  readonly open: ReadonlySet<string>
  readonly folders: ReadonlyMap<string, FolderState>
}

const parentOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf("/")))

const isUnder = (folder: string, path: string) =>
  folder === "" ? path !== "" : path.startsWith(`${folder}/`)

// The child of `folder` that `path` lies in.
const childOn = (folder: string, path: string) => {
  const rest = folder === "" ? path : path.slice(folder.length + 1)
  return rest.split("/")[0] ?? ""
}

// Stores the listing, and forgets what was under a child folder the listing no longer has.
export const withListing = (tree: FolderTree, path: string, listing: FolderState): FolderTree => {
  const folders = new Map(tree.folders).set(path, listing)
  if (listing.kind !== "listed") return { ...tree, folders }
  const children = new Set(
    listing.entries.filter((entry) => entry.kind === "folder").map((entry) => entry.name),
  )
  const gone = (key: string) => isUnder(path, key) && !children.has(childOn(path, key))
  for (const key of folders.keys()) if (gone(key)) folders.delete(key)
  const open = [...tree.open].filter((key) => !gone(key))
  return { open: open.length === tree.open.size ? tree.open : new Set(open), folders }
}

// The listed folders that hold one of `paths`, shallowest first.
export const foldersToReload = (
  tree: FolderTree,
  paths: ReadonlyArray<string>,
): ReadonlyArray<string> =>
  [...new Set(paths.map(parentOf))]
    .filter((folder) => tree.folders.get(folder)?.kind === "listed")
    .sort((a, b) =>
      a === "" ? -1 : b === "" ? 1 : a.split("/").length - b.split("/").length || (a < b ? -1 : 1),
    )
