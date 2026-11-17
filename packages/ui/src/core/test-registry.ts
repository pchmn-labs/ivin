import { AtomRegistry } from "effect/reactivity"
import { makeFakeServer } from "./fake-server-client.ts"
import { serverClientLayerAtom } from "./server-client.ts"

export const makeTestRegistry = () => {
  const server = makeFakeServer()
  const registry = AtomRegistry.make({ initialValues: [[serverClientLayerAtom, server.layer]] })
  return { server, registry }
}
