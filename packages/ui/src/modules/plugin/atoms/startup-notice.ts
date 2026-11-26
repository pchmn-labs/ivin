import type { StartupNotice } from "@ivin/contracts/plugin"
import { Atom } from "effect/reactivity"

export const startupNoticeAtom = Atom.make<StartupNotice | null>(null).pipe(Atom.keepAlive)
