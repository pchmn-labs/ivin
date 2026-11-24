import { RegistryContext, RegistryProvider } from "@effect/atom-react"
import type { UpdateState } from "@ivin/contracts/update"
import { useContext } from "react"
import { afterEach, expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  NotificationProvider,
  NotificationViewport,
} from "../../../core/components/notification/notification.tsx"
import { runCommand } from "../../command/atoms/run-command.ts"
import { useUpdateCommands } from "./use-update-commands.ts"

afterEach(() => Reflect.deleteProperty(window, "ivin"))

function Probe() {
  useUpdateCommands()
  const registry = useContext(RegistryContext)
  return <button onClick={() => runCommand(registry, "update.check")}>Check</button>
}

const check = async (result: UpdateState) => {
  Object.assign(window, { ivin: { checkForUpdates: () => Promise.resolve(result) } })
  await render(
    <RegistryProvider>
      <NotificationProvider>
        <Probe />
        <NotificationViewport />
      </NotificationProvider>
    </RegistryProvider>,
  )
  await page.getByRole("button", { name: "Check" }).click()
}

test("Check for updates says when the app is up to date", async () => {
  await check({ kind: "idle", current: "0.3.2" })

  await expect.element(page.getByText("ivin is up to date (0.3.2).")).toBeVisible()
})

test("Check for updates stays quiet when it found an update, as the sidebar shows it", async () => {
  await check({ kind: "checking", current: "0.3.2" })

  await expect.element(page.getByText(/up to date/)).not.toBeInTheDocument()
})
