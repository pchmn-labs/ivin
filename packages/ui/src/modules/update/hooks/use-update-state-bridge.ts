import { RegistryContext } from "@effect/atom-react"
import { useContext, useEffect } from "react"
import type { UpdateState } from "@ivin/contracts/update"
import { updateStateAtom } from "../atoms/update-state.ts"
import { getUpdateState, onUpdateState } from "../adapters/desktop-update.ts"

export function useUpdateStateBridge() {
  const registry = useContext(RegistryContext)
  useEffect(() => {
    const apply = (state: UpdateState) => registry.set(updateStateAtom, state)
    const stop = onUpdateState(apply)
    void getUpdateState().then(apply)
    return stop
  }, [registry])
}
