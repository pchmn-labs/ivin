import { Atom } from "effect/reactivity"
import { emptyHistory, type SessionHistory } from "../rules/session-history.ts"

export const sessionHistoryAtom = Atom.make<SessionHistory>(emptyHistory)
