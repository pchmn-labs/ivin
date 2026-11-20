import { AsyncResult, Atom } from "effect/reactivity"
import { getHarnessAtom } from "../../server/atoms/get-harness.ts"
import { HARNESSES, newSessionModel } from "../rules/harnesses.ts"

const pickedModelAtom = Atom.make<string | null>(null).pipe(Atom.keepAlive)

const newSessionHarnessAtom = Atom.readable((get) =>
  AsyncResult.getOrElse(get(getHarnessAtom), () => null),
)

export const newSessionModelsAtom = Atom.readable((get) => {
  const harness = get(newSessionHarnessAtom)
  return harness === null ? [] : HARNESSES[harness].models
})

// Null until the server says which harness new sessions start on.
export const newSessionModelAtom = Atom.writable(
  (get) => {
    const harness = get(newSessionHarnessAtom)
    return harness === null ? null : newSessionModel(harness, get(pickedModelAtom))
  },
  (ctx, model: string) => ctx.set(pickedModelAtom, model),
)
