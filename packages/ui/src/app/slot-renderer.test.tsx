import { RegistryProvider } from "@effect/atom-react"
import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { defineUi } from "@ivin/plugin-api/ui"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { PluginsProvider } from "./plugin-host.tsx"
import type { UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"
import { Slot } from "./slot-renderer.tsx"

const plugin = (id: string, text: string, options = {}): UiPluginEntry => ({
  manifest: { id },
  activate: defineUi((ctx) => {
    ctx.slots.add("composer.status", () => <span>{text}</span>, { name: "status", ...options })
  }),
})

const app = (plugins: ReadonlyArray<UiPluginEntry>) => (
  <RegistryProvider initialValues={[[serverClientLayerAtom, makeFakeServer().layer]]}>
    <PluginsProvider plugins={plugins}>
      <div data-testid="status">
        <Slot slot="composer.status" props={{ sessionId: "s1" }} />
      </div>
    </PluginsProvider>
  </RegistryProvider>
)

const status = () => document.querySelector('[data-testid="status"]')!.textContent

test("contributions render in order", async () => {
  await render(app([plugin("a", "A", { order: 2 }), plugin("b", "B", { order: 1 })]))
  await vi.waitFor(() => expect(status()).toBe("BA"))
})

test("a contribution that replaces another takes its place", async () => {
  await render(
    app([plugin("a", "A"), plugin("b", "B", { replaces: "a/status" }), plugin("c", "C")]),
  )
  await vi.waitFor(() => expect(status()).toBe("BC"))
})

test("a contribution that throws shows an error naming its plugin and the others still render", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  const broken: UiPluginEntry = {
    manifest: { id: "prs" },
    activate: defineUi((ctx) => {
      ctx.slots.add("composer.status", () => {
        throw new Error("boom")
      })
    }),
  }
  await render(app([plugin("a", "A"), broken, plugin("c", "C")]))
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent("plugin prs failed — see ivin plugin logs prs")
  expect(status()).toContain("A")
  expect(status()).toContain("C")
})

test("deactivating a plugin removes its contributions", async () => {
  const a = plugin("a", "A")
  const b = plugin("b", "B")
  const { rerender } = await render(app([a, b]))
  await vi.waitFor(() => expect(status()).toBe("AB"))
  await rerender(app([a]))
  await vi.waitFor(() => expect(status()).toBe("A"))
})

test("a tool-call contribution with a tool name renders only for that tool", async () => {
  const bash: UiPluginEntry = {
    manifest: { id: "bash" },
    activate: defineUi((ctx) => {
      ctx.slots.add("transcript.toolCall", () => <span>bash view</span>, { tool: "Bash" })
    }),
  }
  const item = (name: string) =>
    ({
      id: "t",
      sessionId: "s1",
      position: 0,
      at: 0,
      type: "tool_call",
      toolCallId: "c",
      name,
      kind: "other",
      input: null,
      status: "done",
      output: null,
    }) as const
  await render(
    <RegistryProvider>
      <PluginsProvider plugins={[bash]}>
        <div data-testid="status">
          <Slot
            slot="transcript.toolCall"
            tool="Bash"
            props={{ item: item("Bash"), sessionId: "s1" }}
          />
          <Slot
            slot="transcript.toolCall"
            tool="Read"
            props={{ item: item("Read"), sessionId: "s1" }}
          />
        </div>
      </PluginsProvider>
    </RegistryProvider>,
  )
  await vi.waitFor(() => expect(status()).toBe("bash view"))
})
