import { RegistryProvider } from "@effect/atom-react"
import { createElement, useState } from "react"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { defineUi, type TreeRow } from "@ivin/plugin-api/ui"
import fileIconsPackage from "../../../../../../plugins/file-icons/package.json"
import * as fileIcons from "../../../../../../plugins/file-icons/src/ui.tsx"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import type { UiPluginEntry } from "../../../modules/plugin/atoms/activate-plugin.ts"
import { makeFakeServer } from "../../fake-server-client.ts"
import { serverClientLayerAtom } from "../../server-client.ts"
import { Tree } from "./tree.tsx"

const rows: ReadonlyArray<TreeRow> = [
  { id: "src", name: "src", depth: 0, expanded: true },
  { id: "src/main.ts", name: "main.ts", depth: 1, expanded: null },
]

function Harness({ plugins }: { plugins: ReadonlyArray<UiPluginEntry> }) {
  const [server] = useState(() => makeFakeServer())
  return (
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={plugins}>
        <div style={{ display: "flex", height: 300 }}>
          <Tree label="Files" rows={rows} onToggle={() => undefined} />
        </div>
      </PluginsProvider>
    </RegistryProvider>
  )
}

const icon = (name: string) =>
  page.getByRole("treeitem", { name, exact: true }).element().querySelector(".iv-tree__icon")

const iconsPlugin = (id: string, draw: (name: string) => string | null): UiPluginEntry => ({
  manifest: { id },
  activate: defineUi((ctx) =>
    ctx.fileIcons.add(({ name }) => {
      const label = draw(name)
      return label === null ? null : createElement("i", { "data-icon": label })
    }),
  ),
})

test("a row draws the icon of the first plugin that gives one, else the tree's own", async () => {
  await render(
    <Harness
      plugins={[
        iconsPlugin("none", () => null),
        iconsPlugin("ts", (name) => (name.endsWith(".ts") ? "ts" : null)),
        iconsPlugin("all", () => "all"),
      ]}
    />,
  )
  await expect.poll(() => icon("main.ts")?.querySelector("i")?.dataset["icon"]).toBe("ts")
  expect(icon("src")?.querySelector("i")?.dataset["icon"]).toBe("all")
})

test("with no plugin giving icons, a row keeps the tree's own icon", async () => {
  await render(<Harness plugins={[iconsPlugin("none", () => null)]} />)
  await expect.poll(() => icon("main.ts")?.querySelector("svg")).not.toBeNull()
  expect(icon("main.ts")?.querySelector("i, img")).toBeNull()
})

test("with the file-icons plugin turned off, the rows show the tree's own icons again", async () => {
  const withIcons = [{ manifest: fileIconsPackage.ivin, activate: fileIcons.activate }]
  const screen = await render(<Harness plugins={withIcons} />)
  await expect.poll(() => icon("main.ts")?.querySelector("img")).not.toBeNull()

  await screen.rerender(<Harness plugins={[]} />)
  await expect.poll(() => icon("main.ts")?.querySelector("svg")).not.toBeNull()
  expect(icon("main.ts")?.querySelector("img")).toBeNull()
})
