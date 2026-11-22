import type { Change, ChangeListItem } from "@ivin/plugin-api/ui"

export const changeItems = (changes: ReadonlyArray<Change>): ReadonlyArray<ChangeListItem> =>
  changes.map((change) => {
    const slash = change.path.lastIndexOf("/")
    return {
      id: change.path,
      name: change.path.slice(slash + 1),
      folder: slash < 0 ? "" : change.path.slice(0, slash),
      status: change.status,
      added: change.added,
      deleted: change.deleted,
      ...(change.previousPath !== null && { title: `Renamed from ${change.previousPath}` }),
    }
  })
