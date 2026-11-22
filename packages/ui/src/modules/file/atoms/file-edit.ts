import { Atom } from "effect/reactivity"
import { type FileEdit, isUnsaved, noEdit } from "../rules/file-edit.ts"

interface Edited extends FileEdit {
  readonly sessionId: string
  readonly workingFolder: string
  readonly path: string
}

const editsAtom = Atom.make<ReadonlyMap<string, Edited>>(new Map()).pipe(Atom.keepAlive)

const folderKeyOf = (sessionId: string, workingFolder: string) => `${sessionId}\n${workingFolder}`

const keyOf = (sessionId: string, workingFolder: string, path: string) =>
  `${folderKeyOf(sessionId, workingFolder)}\n${path}`

const family = Atom.family((key: string) => {
  const [sessionId = "", workingFolder = "", path = ""] = key.split("\n")
  return Atom.writable(
    (get): FileEdit => get(editsAtom).get(key) ?? noEdit,
    (ctx, edit: FileEdit) => {
      const edits = new Map(ctx.get(editsAtom))
      if (edit === noEdit) edits.delete(key)
      else edits.set(key, { ...edit, sessionId, workingFolder, path })
      ctx.set(editsAtom, edits)
    },
  )
})

export const fileEditOf = (sessionId: string, workingFolder: string, path: string) =>
  family(keyOf(sessionId, workingFolder, path))

const unsavedFamily = Atom.family((folderKey: string) =>
  Atom.readable((get) =>
    [...get(editsAtom).values()]
      .filter((edit) => `${edit.sessionId}\n${edit.workingFolder}` === folderKey && isUnsaved(edit))
      .map((edit) => edit.path)
      .join("\n"),
  ),
)

// Through a string, so a keystroke in a file that was already unsaved notifies no one.
const unsavedPathsFamily = Atom.family((folderKey: string) =>
  Atom.readable((get): ReadonlyArray<string> => {
    const paths = get(unsavedFamily(folderKey))
    return paths === "" ? [] : paths.split("\n")
  }),
)

export const unsavedPathsOf = (sessionId: string, workingFolder: string) =>
  unsavedPathsFamily(folderKeyOf(sessionId, workingFolder))

export const discardSessionEditsAtom = Atom.fnSync((sessionId: string, get) => {
  const edits = new Map(get(editsAtom))
  for (const [key, edit] of edits) if (edit.sessionId === sessionId) edits.delete(key)
  get.set(editsAtom, edits)
})
