import { RegistryProvider } from "@effect/atom-react"
import { defineUi, usePendingApproval } from "@ivin/plugin-api/ui"
import type { SlotProps } from "@ivin/plugin-api/ui"
import { DateTime } from "effect"
import { memo } from "react"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { SessionView } from "../modules/session/ui/session-view.tsx"
import type { UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"
import { builtinPlugins } from "./builtin-plugins.ts"
import { PluginsProvider } from "./plugin-host.tsx"

let renders = 0

// Memoized on the session's id, so a re-render comes from the hook alone, not from the composer.
const Probe = memo(
  function Probe({ session }: SlotProps["composer.above"]) {
    renders += 1
    return <p>{usePendingApproval(session.id)?.name ?? "nothing pending"}</p>
  },
  (before, after) => before.session.id === after.session.id,
)

const probing: UiPluginEntry = {
  manifest: { id: "probe" },
  activate: defineUi((ctx) => {
    ctx.slots.add("composer.above", Probe)
  }),
}

const item = { sessionId: "s1", at: 0, steer: false, images: [] }

test("a composer.above sheet does not re-render when a message arrives in the transcript", async () => {
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.sessions.set("s1", makeTestSession({ id: "s1", projectPath: "/p", title: "Cart" }))
  server.openTab("s1")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={[...builtinPlugins, probing]}>
        <SessionView projectPath="/p" sessionId="s1" />
      </PluginsProvider>
    </RegistryProvider>,
  )
  await expect.element(page.getByText("nothing pending")).toBeVisible()

  server.pushItem({
    ...item,
    id: "m1",
    position: 1,
    type: "message",
    role: "assistant",
    text: "Done with the cart",
  })
  await expect.element(page.getByText("Done with the cart")).toBeVisible()
  const before = renders

  server.pushItem({
    ...item,
    id: "m2",
    position: 2,
    type: "message",
    role: "assistant",
    text: "And the checkout too",
  })
  await expect.element(page.getByText("And the checkout too")).toBeVisible()
  expect(renders).toBe(before)

  server.pushItem({
    ...item,
    id: "a1",
    position: 3,
    type: "approval",
    requestId: "r1",
    toolCallId: null,
    name: "Bash",
    input: { command: "ls" },
    decision: null,
  })
  await expect.element(page.getByText("Bash", { exact: true })).toBeVisible()
})
