import type { FileList } from "@ivin/contracts/file"

export const limitFiles = (paths: ReadonlyArray<string>, limit: number): FileList => {
  const sorted = [...new Set(paths)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  return { paths: sorted.slice(0, limit), truncated: sorted.length > limit }
}
