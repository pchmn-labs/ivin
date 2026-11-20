import { Atom } from "effect/reactivity"

// The sidebar's list column shows the selected project's archived sessions in place of its sessions.
export const archivedViewOpenAtom = Atom.make(false)
