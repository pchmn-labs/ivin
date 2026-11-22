import type { FileIconRow } from "@ivin/plugin-api/ui"

export const fileIconOf = <Icon>(
  icons: ReadonlyArray<(row: FileIconRow) => Icon | null | undefined>,
  row: FileIconRow,
): Icon | null => {
  for (const icon of icons) {
    const drawn = icon(row)
    if (drawn != null) return drawn
  }
  return null
}
