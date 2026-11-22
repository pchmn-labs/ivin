export interface SaveFailure {
  readonly text: string
  readonly retryable: boolean
}

export interface FileEdit {
  // The file as last read or saved; the draft was typed over it.
  readonly base: { readonly text: string; readonly version: string } | null
  // What the user typed, while it differs from the base.
  readonly draft: string | null
  // The file on disk is no longer the base, while the user has a draft.
  readonly changedOnDisk: boolean
  readonly saving: boolean
  readonly failure: SaveFailure | null
}

export const noEdit: FileEdit = {
  base: null,
  draft: null,
  changedOnDisk: false,
  saving: false,
  failure: null,
}

export const isUnsaved = (edit: FileEdit) => edit.draft !== null

export const shownText = (edit: FileEdit): string | null => edit.draft ?? edit.base?.text ?? null

export const withRead = (edit: FileEdit, read: NonNullable<FileEdit["base"]>): FileEdit => {
  if (edit.draft === null || edit.base === null) return { ...edit, base: read }
  return read.version === edit.base.version ? edit : { ...edit, changedOnDisk: true }
}

export const withTyped = (edit: FileEdit, text: string): FileEdit => ({
  ...edit,
  draft: text === edit.base?.text ? null : text,
})

export const withSaving = (edit: FileEdit): FileEdit => ({ ...edit, saving: true, failure: null })

export const withSaved = (edit: FileEdit, text: string, version: string): FileEdit => ({
  ...edit,
  base: { text, version },
  draft: edit.draft === text ? null : edit.draft,
  changedOnDisk: false,
  saving: false,
})

export const withSaveFailed = (edit: FileEdit, failure: SaveFailure): FileEdit => ({
  ...edit,
  saving: false,
  failure,
})

export const withChangedOnDisk = (edit: FileEdit): FileEdit => ({
  ...edit,
  saving: false,
  changedOnDisk: true,
  failure: null,
})
