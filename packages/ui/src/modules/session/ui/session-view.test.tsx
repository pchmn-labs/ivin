import { RegistryProvider } from "@effect/atom-react"
import { DateTime } from "effect"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../app/builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { selectedSessionIdAtom } from "../atoms/selected-session.ts"
import { SessionView } from "./session-view.tsx"

test("the transcript renders through the plugins and the status line shows the usage", async () => {
  const server = makeFakeServer()
  const base = { sessionId: "s1" }
  server.seedItems("s1", [
    { ...base, id: "m0", position: 0, type: "message", role: "user", text: "hello" },
    {
      ...base,
      id: "t1",
      position: 1,
      type: "tool_call",
      toolCallId: "c1",
      name: "Bash",
      input: null,
      status: "done",
      output: "ok",
    },
    {
      ...base,
      id: "u2",
      position: 2,
      type: "usage",
      inputTokens: 1000,
      outputTokens: 200,
      costUsd: 0.01,
    },
    {
      ...base,
      id: "u3",
      position: 3,
      type: "usage",
      inputTokens: 300,
      outputTokens: 40,
      costUsd: 0.0023,
    },
  ])
  const at = DateTime.makeUnsafe(0)
  server.sessions.set("s1", {
    id: "s1",
    projectPath: "/p",
    title: "t",
    createdAt: at,
    lastActivityAt: at,
  })

  await render(
    <RegistryProvider
      initialValues={[
        [serverClientLayerAtom, server.layer],
        [selectedSessionIdAtom, "s1"],
      ]}
    >
      <PluginsProvider plugins={builtinPlugins}>
        <SessionView projectPath="/p" />
      </PluginsProvider>
    </RegistryProvider>,
  )

  await expect.element(page.getByText("hello", { exact: true })).toBeVisible()
  await expect.element(page.getByTestId("tool-status")).toHaveTextContent("done")
  expect(document.querySelectorAll('[data-testid="transcript-item"]')).toHaveLength(2)
  await expect
    .element(page.getByTestId("composer-status"))
    .toHaveTextContent("1,540 tokens · $0.0123")
})
