import { Atom } from "effect/reactivity"
import type { ServerState } from "../../../core/desktop-bridge.ts"

export const serverStateAtom = Atom.make<ServerState>({ kind: "running" })
