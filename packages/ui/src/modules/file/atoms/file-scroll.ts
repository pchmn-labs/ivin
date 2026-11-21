import { Atom } from "effect/reactivity"

const family = Atom.family((_key: string) => Atom.make(0).pipe(Atom.keepAlive))

export const fileScrollOf = (sessionId: string, workingFolder: string, path: string) =>
  family(`${sessionId}\n${workingFolder}\n${path}`)
