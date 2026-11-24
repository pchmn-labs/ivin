import { RegistryContext } from "@effect/atom-react"
import { useContext, useEffect } from "react"
import { updateStateAtom } from "../atoms/update-state.ts"
import { getUpdateState, onUpdateState } from "../adapters/desktop-update.ts"

export function useUpdateStateBridge() {
  const registry = useContext(RegistryContext)
  useEffect(() => {
    const apply = (state: Parameters<Parameters<typeof onUpdateState>[0]>[0]) =>
      registry.set(updateStateAtom, state)
    const stop = onUpdateState(apply)
    void getUpdateState().then(apply)
    return stop
  }, [registry])
}
