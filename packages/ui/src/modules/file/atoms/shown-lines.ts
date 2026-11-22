import { Atom } from "effect/reactivity"
import type { ShownLines } from "../../../core/components/code-view/code-view.tsx"

const family = Atom.family((_key: string) =>
  Atom.make<ShownLines | undefined>(undefined).pipe(Atom.keepAlive),
)

export const shownLinesOf = (sessionId: string, workingFolder: string, path: string) =>
  family(`${sessionId}\n${workingFolder}\n${path}`)
