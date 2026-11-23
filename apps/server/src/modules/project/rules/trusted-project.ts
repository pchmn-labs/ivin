export interface FolderPlace {
  readonly folder: string
  // The main checkout of the repository the folder belongs to, null outside one.
  readonly checkout: string | null
}

const isWithin = (folder: string, parent: string) =>
  folder === parent || folder.startsWith(parent.endsWith("/") ? parent : `${parent}/`)

// Every path is a real path.
export const isInTrustedProject = (trusted: ReadonlyArray<string>, place: FolderPlace) =>
  trusted.some(
    (project) =>
      isWithin(place.folder, project) ||
      (place.checkout !== null && isWithin(place.checkout, project)),
  )
