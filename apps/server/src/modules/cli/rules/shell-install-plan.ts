import type { FolderRefusal } from "@ivin/contracts/cli"

export type IvinEntry =
  | { readonly kind: "absent" }
  | { readonly kind: "link"; readonly target: string }
  | { readonly kind: "other" }

export interface ShellFolder {
  readonly path: string
  // Null when ivin can write there, creating the folder if it is missing.
  readonly refusal: FolderRefusal | null
  readonly entry: IvinEntry
}

export type ShellInstallPlan =
  | { readonly kind: "link"; readonly folder: string }
  | { readonly kind: "notOurs"; readonly path: string }
  | {
      readonly kind: "refused"
      readonly folders: ReadonlyArray<{ readonly path: string; readonly reason: FolderRefusal }>
    }

export const commandPathIn = (folder: string) => `${folder.replace(/\/+$/, "")}/ivin`

export const entryOwner = (entry: IvinEntry, command: string): "absent" | "ours" | "foreign" => {
  if (entry.kind === "absent") return "absent"
  return entry.kind === "link" && entry.target === command ? "ours" : "foreign"
}

export const shellInstallPlan = (
  folders: ReadonlyArray<ShellFolder>,
  command: string,
): ShellInstallPlan => {
  const writable = folders.filter((folder) => folder.refusal === null)
  const ours = writable.find((folder) => entryOwner(folder.entry, command) === "ours")
  if (ours) return { kind: "link", folder: ours.path }
  const first = writable[0]
  if (first === undefined) {
    return {
      kind: "refused",
      folders: folders.map((folder) => ({ path: folder.path, reason: folder.refusal! })),
    }
  }
  return entryOwner(first.entry, command) === "absent"
    ? { kind: "link", folder: first.path }
    : { kind: "notOurs", path: commandPathIn(first.path) }
}

export const installedLink = (folders: ReadonlyArray<ShellFolder>, command: string) =>
  folders.find((folder) => entryOwner(folder.entry, command) === "ours")?.path ?? null

const normalized = (folder: string, home: string) =>
  folder.replace(/^~(?=\/|$)/, home).replace(/\/+$/, "")

export const isFolderOnPath = (folder: string, pathEntries: ReadonlyArray<string>, home: string) =>
  pathEntries.some((entry) => normalized(entry, home) === normalized(folder, home))
