import { RegistryProvider } from "@effect/atom-react"
import type { ProjectPlugin } from "@ivin/contracts/plugin"
import { DateTime } from "effect"
import { expect, test } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { ProjectPluginSheets } from "./project-plugin-sheets.tsx"

const changed: ProjectPlugin = {
  id: "pr-checks",
  name: "PR checks",
  state: "changed",
  hash: "abc",
  files: [{ path: "server.ts", status: "M" }],
  diff: "@@ -1 +1 @@\n-old line\n+new line\n",
  permissionsChanged: false,
  permissions: { harness: [], exec: ["gh"], fetch: [] },
  hasServer: true,
}

const mount = async (plugin: ProjectPlugin = changed) => {
  const server = makeFakeServer({
    project: { path: "/dev/shop", name: "shop", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.projectPlugins.push({
    project: "/dev/shop",
    projectName: "shop",
    openAs: [],
    fullTrust: false,
    plugins: [plugin],
    changes: [],
  })
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <ProjectPluginSheets />
    </RegistryProvider>,
  )
  return server
}

test("reviewing a changed plugin shows its diff, and trusting that version sends the hash it showed", async () => {
  const server = await mount()
  await expect.element(page.getByText("“PR checks” changed in this project")).toBeVisible()

  await page.getByRole("button", { name: "Review" }).click()
  await expect.element(page.getByText("+new line")).toBeVisible()
  await expect.element(page.getByText("Runs gh")).toBeVisible()
  await page.getByRole("button", { name: "Trust this version" }).click()

  expect(server.pluginTrusts).toEqual([{ project: "/dev/shop", id: "pr-checks", hash: "abc" }])
  await expect
    .element(page.getByText("“PR checks” changed in this project"))
    .not.toBeInTheDocument()
})

test("trusting all changes turns full trust on for the project, and the sheet goes", async () => {
  const server = await mount()

  await page.getByRole("button", { name: "Trust all changes" }).click()

  await expect
    .element(page.getByText("“PR checks” changed in this project"))
    .not.toBeInTheDocument()
  expect(server.projectPlugins[0]?.fullTrust).toBe(true)
})

test("a plugin whose permissions changed can only be trusted for this version", async () => {
  await mount({ ...changed, permissionsChanged: true })

  await expect.element(page.getByRole("button", { name: "Trust this version" })).toBeVisible()
  await expect
    .element(page.getByRole("button", { name: "Trust all changes" }))
    .not.toBeInTheDocument()
})

test("a plugin that changed again before the user trusted it stays, with the new state and why", async () => {
  const server = await mount()
  await expect.element(page.getByRole("button", { name: "Review" })).toBeVisible()
  server.projectPlugins[0] = {
    ...server.projectPlugins[0]!,
    plugins: [{ ...changed, hash: "newer", files: [{ path: "ui.tsx", status: "M" }] }],
  }
  // The window still holds the version streamed before this one.
  await page.getByRole("button", { name: "Review" }).click()
  await page.getByRole("button", { name: "Trust this version" }).click()

  await expect.element(page.getByText(/changed again, so nothing was trusted/)).toBeVisible()
  expect(server.pluginTrusts).toEqual([])
})
