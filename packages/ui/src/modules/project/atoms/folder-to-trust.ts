import { Atom } from "effect/reactivity"

// A folder the server refused to open until the user trusts it.
export const folderToTrustAtom = Atom.make<string | null>(null)
