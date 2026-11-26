import { Atom } from "effect/reactivity"
import type { CodeScroll } from "../../../core/components/code-view/code-view.tsx"

const family = Atom.family((_key: string) =>
  Atom.make<CodeScroll | undefined>(undefined).pipe(Atom.keepAlive),
)

export const fileScrollOf = (sessionId: string, workingFolder: string, path: string) =>
  family(`${sessionId}\n${workingFolder}\n${path}`)
