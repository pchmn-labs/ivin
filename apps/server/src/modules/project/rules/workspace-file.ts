import { parseJsonc } from "@ivin/contracts/jsonc"

export const WORKSPACE_EXTENSION = ".code-workspace"

export const isWorkspaceFile = (path: string) => path.endsWith(WORKSPACE_EXTENSION)

export const workspaceName = (path: string) =>
  (path.split("/").at(-1) ?? path).slice(0, -WORKSPACE_EXTENSION.length)

const resolved = (file: string, path: string) => {
  const parts = (path.startsWith("/") ? path : `${file.slice(0, file.lastIndexOf("/"))}/${path}`)
    .split("/")
    .filter((part) => part !== "" && part !== ".")
  const out: string[] = []
  for (const part of parts) {
    if (part === "..") out.pop()
    else out.push(part)
  }
  return `/${out.join("/")}`
}

// The folders the file lists, absolute and in its order; null when the file is not a workspace.
// A folder given as a `uri` (remote, virtual) has no path on this disk and is skipped.
export const workspaceFolders = (text: string, file: string): readonly string[] | null => {
  const parsed = parseJsonc(text)
  if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null) return null
  const { folders } = parsed.value as { folders?: unknown }
  if (!Array.isArray(folders)) return null
  const found: string[] = []
  for (const entry of folders) {
    const path = (entry as { path?: unknown } | null)?.path
    if (typeof path !== "string") continue
    const folder = resolved(file, path)
    if (!found.includes(folder)) found.push(folder)
  }
  return found
}
