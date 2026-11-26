export const UNCOMMITTED = "uncommitted"
export const COMMITTED = "committed"

export const repositoryGroupId = (repository: string) => `${UNCOMMITTED}:${repository}`
export const isUncommitted = (groupId: string) =>
  groupId === UNCOMMITTED || groupId.startsWith(`${UNCOMMITTED}:`)
// The list's keybinding area, where `changes.discard` and `changes.discardAll` apply.
export const AREA = "changes"
