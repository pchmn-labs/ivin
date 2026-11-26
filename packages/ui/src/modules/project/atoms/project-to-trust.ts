import { Atom } from "effect/reactivity"

// A project the server refused to open until the user trusts it; `folders` are those of a workspace
// still untrusted, empty for a folder.
export interface ProjectToTrust {
  readonly path: string
  readonly folders: ReadonlyArray<string>
}

export const projectToTrustAtom = Atom.make<ProjectToTrust | null>(null)
