import { RegistryProvider, useAtomValue } from "@effect/atom-react"
import { afterEach, expect, test } from "vitest"
import { render } from "vitest-browser-react"
import type { ServerState } from "../../../core/desktop-bridge.ts"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { connectionAtom } from "../atoms/connection.ts"
import { useServerStateBridge } from "./use-server-state-bridge.ts"

const server = makeFakeServer()

function Probe() {
  useServerStateBridge()
  const connection = useAtomValue(connectionAtom)
  const layer = useAtomValue(serverClientLayerAtom)
  return (
    <p>
      {connection.state} / {layer === server.layer ? "first client" : "new client"}
    </p>
  )
}

const installDesktop = (initial: ServerState) => {
  let listener: (state: ServerState) => void = () => {}
  Object.assign(window, {
    ivin: {
      getServerState: () => Promise.resolve(initial),
      onServerState: (next: (state: ServerState) => void) => {
        listener = next
        return () => {}
      },
    },
  })
  return (state: ServerState) => listener(state)
}

afterEach(() => Reflect.deleteProperty(window, "ivin"))

test("a restarted server gets a new client, and the connection shows the restart meanwhile", async () => {
  const emit = installDesktop({ kind: "running" })
  const screen = await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <Probe />
    </RegistryProvider>,
  )

  await expect.element(screen.getByText("connected / first client")).toBeVisible()

  emit({ kind: "restarting" })
  await expect.element(screen.getByText("restarting / first client")).toBeVisible()

  emit({ kind: "running" })
  await expect.element(screen.getByText(/new client/)).toBeVisible()
})
