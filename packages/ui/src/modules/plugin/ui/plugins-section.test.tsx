import { RegistryProvider } from "@effect/atom-react"
import { expect, test } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { PluginsSection } from "./plugins-section.tsx"

const mount = async (fullTrust: boolean) => {
  const server = makeFakeServer()
  server.projectPlugins.push({
    project: "/dev/shop",
    projectName: "shop",
    openAs: [],
    fullTrust,
    plugins: [
      {
        id: "pr-checks",
        name: "PR checks",
        state: fullTrust ? "trusted" : "changed",
        hash: "abc",
        files: [{ path: "server.ts", status: "M" }],
        diff: "",
        permissionsChanged: false,
        permissions: [],
      },
    ],
    changes: [
      {
        id: "pr-checks",
        name: "PR checks",
        hash: "old",
        at: Date.now() - 120_000,
        isNew: false,
        files: [{ path: "server.ts", status: "M" }],
        diff: "",
        seen: false,
      },
    ],
  })
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <ul>
        <PluginsSection />
      </ul>
    </RegistryProvider>,
  )
  return server
}

test("turning the switch on trusts every change to the project, and its recent changes show", async () => {
  const server = await mount(false)

  await page.getByRole("switch").click()

  await expect.element(page.getByText("Recent changes")).toBeVisible()
  expect(server.projectPlugins[0]?.fullTrust).toBe(true)
})

test("marking the recent changes as read removes their unread marks", async () => {
  const server = await mount(true)
  await expect.element(page.getByRole("img", { name: "Unread" })).toBeVisible()

  await page.getByRole("button", { name: "Mark as read" }).click()

  await expect.element(page.getByRole("img", { name: "Unread" })).not.toBeInTheDocument()
  expect(server.projectPlugins[0]?.changes.every((change) => change.seen)).toBe(true)
})

test("a plugin waiting for trust is trusted from the page, with the hash it showed", async () => {
  const server = await mount(false)

  await page.getByRole("button", { name: "Trust this version of PR checks" }).click()

  expect(server.pluginTrusts).toEqual([{ project: "/dev/shop", id: "pr-checks", hash: "abc" }])
})

test("a plugin stream that fails shows a message with a retry", async () => {
  const server = makeFakeServer()
  server.failNextCall("plugin.projectPlugins")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <ul>
        <PluginsSection />
      </ul>
    </RegistryProvider>,
  )
  await expect
    .element(page.getByText("ivin could not read the plugins of your projects."))
    .toBeVisible()

  await page.getByRole("button", { name: "Retry" }).click()

  await expect.element(page.getByText(/No project you trust ships a plugin/)).toBeVisible()
})
