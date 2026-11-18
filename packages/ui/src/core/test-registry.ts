import { DateTime } from "effect"
import { AtomRegistry } from "effect/reactivity"
import { makeFakeServer } from "./fake-server-client.ts"
import { serverClientLayerAtom } from "./server-client.ts"

// `project` is the path of a folder already open on the fake server.
export const makeTestRegistry = (options: { readonly project?: string } = {}) => {
  const server = makeFakeServer(
    options.project === undefined
      ? {}
      : {
          project: {
            path: options.project,
            name: options.project.split("/").at(-1)!,
            lastOpenedAt: DateTime.makeUnsafe(0),
          },
        },
  )
  const registry = AtomRegistry.make({ initialValues: [[serverClientLayerAtom, server.layer]] })
  return { server, registry }
}
