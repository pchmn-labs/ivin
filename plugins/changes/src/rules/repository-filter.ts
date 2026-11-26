import type { Change } from "@ivin/plugin-api/ui"

export const ALL = "\0all"

export interface RepositoryChip {
  readonly value: string
  readonly label: string
  readonly count: number
}

const within = (repository: string, change: Change) => change.path.startsWith(`${repository}/`)

// A repository with no change gets no chip, and a pick that lost its last change falls back to all.
export const repositoryChips = (
  repositories: ReadonlyArray<string>,
  changes: ReadonlyArray<Change>,
  picked: string,
) => {
  const options = repositories
    .map((name) => ({
      value: name,
      label: name,
      count: new Set(changes.filter((change) => within(name, change)).map((c) => c.path)).size,
    }))
    .filter((chip) => chip.count > 0)
  const chips: ReadonlyArray<RepositoryChip> =
    options.length < 2
      ? []
      : [
          { value: ALL, label: "All", count: new Set(changes.map((change) => change.path)).size },
          ...options,
        ]
  return { chips, picked: chips.some((chip) => chip.value === picked) ? picked : ALL }
}

export const inRepository = (changes: ReadonlyArray<Change>, picked: string) =>
  picked === ALL ? changes : changes.filter((change) => within(picked, change))
