import { RegistryProvider, useAtomValue } from "@effect/atom-react"
import type { UpdateState } from "@ivin/contracts/update"
import { act, useState } from "react"
import { afterEach, expect, test } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"
import { updateStateAtom } from "../atoms/update-state.ts"
import { useUpdateStateBridge } from "./use-update-state-bridge.ts"

afterEach(() => Reflect.deleteProperty(window, "ivin"))

function Probe() {
  useUpdateStateBridge()
  return <p>{useAtomValue(updateStateAtom)?.kind ?? "unknown"}</p>
}

test("the window shows the state the desktop app has, then each one it sends", async () => {
  let emit: (state: UpdateState) => void = () => {}
  Object.assign(window, {
    ivin: {
      getUpdateState: () => Promise.resolve({ kind: "idle", current: "0.3.2" }),
      onUpdateState: (listener: (state: UpdateState) => void) => {
        emit = listener
        return () => {}
      },
    },
  })
  await render(
    <RegistryProvider>
      <Probe />
    </RegistryProvider>,
  )
  await expect.element(page.getByText("idle")).toBeVisible()

  act(() => emit({ kind: "checking", current: "0.3.2" }))

  await expect.element(page.getByText("checking")).toBeVisible()
})

test("a state sent before anything shows it is still there when the update button mounts", async () => {
  let emit: (state: UpdateState) => void = () => {}
  Object.assign(window, {
    ivin: {
      getUpdateState: () => Promise.resolve({ kind: "idle", current: "0.3.2" }),
      onUpdateState: (listener: (state: UpdateState) => void) => {
        emit = listener
        return () => {}
      },
    },
  })
  function Late() {
    const [mounted, setMounted] = useState(false)
    useUpdateStateBridge()
    return (
      <>
        <button type="button" onClick={() => setMounted(true)}>
          Mount
        </button>
        {mounted && <Reader />}
      </>
    )
  }
  function Reader() {
    return <p>{useAtomValue(updateStateAtom)?.kind ?? "unknown"}</p>
  }
  await render(
    <RegistryProvider>
      <Late />
    </RegistryProvider>,
  )

  act(() => emit({ kind: "ready", current: "0.3.2", version: "0.4.0", notes: "", url: "" }))
  await page.getByRole("button", { name: "Mount" }).click()

  await expect.element(page.getByText("ready")).toBeVisible()
})
