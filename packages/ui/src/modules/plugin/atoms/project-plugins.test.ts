import type { ProjectPlugin, ProjectPlugins } from "@ivin/contracts/plugin"
import { AsyncResult } from "effect/reactivity"
import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { markChangesSeenOf } from "./mark-changes-seen.ts"
import { projectPluginsAtom } from "./project-plugins.ts"
import { setFullTrustOf } from "./set-full-trust.ts"
import { trustKey, trustProjectPluginOf } from "./trust-project-plugin.ts"

const plugin = (state: ProjectPlugin["state"], hash: string): ProjectPlugin => ({
  id: "pr-checks",
  name: "PR checks",
  state,
  hash,
  files: [{ path: "server.ts", status: "M" }],
  diff: "",
  permissionsChanged: false,
  permissions: { harness: [], exec: [], fetch: [] },
  hasServer: false,
})

const shop = (plugins: ProjectPlugin[]): ProjectPlugins => ({
  project: "/dev/shop",
  projectName: "shop",
  openAs: [],
  fullTrust: false,
  plugins,
  changes: [
    {
      id: "pr-checks",
      name: "PR checks",
      hash: "h1",
      at: 0,
      isNew: false,
      files: [],
      diff: "",
      seen: false,
    },
  ],
})

const setup = async (plugins: ProjectPlugin[]) => {
  const { registry, server } = makeTestRegistry()
  server.projectPlugins.push(shop(plugins))
  registry.mount(projectPluginsAtom)
  await vi.waitFor(() => expect(AsyncResult.isSuccess(registry.get(projectPluginsAtom))).toBe(true))
  const current = () => {
    const result = registry.get(projectPluginsAtom)
    return AsyncResult.isSuccess(result) ? result.value[0]! : null
  }
  return { registry, server, current }
}

const key = { project: "/dev/shop", id: "pr-checks" }
const trustAtom = trustProjectPluginOf(trustKey(key.project, key.id))

test("trusting a plugin sends the hash the user saw, and the plugin then shows as trusted", async () => {
  const { registry, server, current } = await setup([plugin("changed", "abc")])
  registry.mount(trustAtom)

  registry.set(trustAtom, { ...key, hash: "abc" })

  await vi.waitFor(() => expect(current()?.plugins[0]?.state).toBe("trusted"))
  expect(server.pluginTrusts).toEqual([{ ...key, hash: "abc" }])
})

test("a plugin whose files changed again is not trusted, and the failure says so", async () => {
  const { registry, server, current } = await setup([plugin("changed", "newer")])
  registry.mount(trustAtom)

  registry.set(trustAtom, { ...key, hash: "older" })

  await vi.waitFor(() => expect(AsyncResult.isFailure(registry.get(trustAtom))).toBe(true))
  expect(server.pluginTrusts).toEqual([])
  expect(current()?.plugins[0]?.state).toBe("changed")
})

test("full trust is switched on for the project, and its changes are marked as read", async () => {
  const { registry, current } = await setup([plugin("trusted", "abc")])
  registry.mount(setFullTrustOf("/dev/shop"))
  registry.mount(markChangesSeenOf("/dev/shop"))

  registry.set(setFullTrustOf("/dev/shop"), true)
  await vi.waitFor(() => expect(current()?.fullTrust).toBe(true))

  registry.set(markChangesSeenOf("/dev/shop"), undefined)
  await vi.waitFor(() => expect(current()?.changes.every((change) => change.seen)).toBe(true))
})
