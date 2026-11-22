import { RegistryProvider } from "@effect/atom-react"
import { expect, test } from "vitest"
import { page, server } from "vitest/browser"
import { render } from "vitest-browser-react"
import { defineUi, type TreeRow } from "@ivin/plugin-api/ui"
import fileIconsPackage from "../../../../../../plugins/file-icons/package.json"
import * as fileIcons from "../../../../../../plugins/file-icons/src/ui.tsx"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { makeFakeServer } from "../../fake-server-client.ts"
import { serverClientLayerAtom } from "../../server-client.ts"
import { Tree } from "./tree.tsx"

// Below 30 frames a second, scrolling the tree visibly stutters.
const MIN_FPS = 30
const FRAMES = 120

const EXTENSIONS = [
  "tsx",
  "ts",
  "test.ts",
  "js",
  "json",
  "md",
  "css",
  "py",
  "rs",
  "go",
  "yml",
  "svg",
]

// 50 open folders of 100 files each, of kinds that each take another icon of the theme.
const rows: ReadonlyArray<TreeRow> = Array.from({ length: 50 }, (_, folder) => [
  { id: `f${folder}`, name: `folder-${folder}`, depth: 0, expanded: true },
  ...Array.from({ length: 100 }, (_, file) => ({
    id: `f${folder}/${file}`,
    name: `component-${folder}-${file}.${EXTENSIONS[file % EXTENSIONS.length]}`,
    depth: 1,
    expanded: null,
  })),
]).flat()

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

const scrolledFps = async () => {
  await expect.element(page.getByRole("treeitem", { name: "folder-0" })).toBeVisible()
  const scroller = document.querySelector<HTMLElement>(".iv-tree__list")!
  const step = (scroller.scrollHeight - scroller.clientHeight) / FRAMES

  const start = await nextFrame()
  let last = start
  for (let frame = 1; frame <= FRAMES; frame++) {
    scroller.scrollTop = step * frame
    last = await nextFrame()
  }

  expect(scroller.scrollTop).toBeGreaterThan(rows.length * 20)
  return (FRAMES * 1000) / (last - start)
}

test("scrolling a 5,000-file tree keeps the frame rate", async () => {
  await render(
    <div style={{ display: "flex", height: 600 }}>
      <Tree label="Files" rows={rows} onToggle={() => undefined} />
    </div>,
  )
  expect(await scrolledFps()).toBeGreaterThan(MIN_FPS)
})

test("scrolling a 5,000-file tree with the icon theme's icons keeps the frame rate", async () => {
  const pluginFolder = new URL(`/@fs${server.config.root}/../../plugins/file-icons/`, location.href)
  const plugins = [
    {
      manifest: fileIconsPackage.ivin,
      // The test's server stands in for the desktop app's protocol, so the SVGs load and decode.
      activate: defineUi((ctx) =>
        fileIcons.activate({ ...ctx, fileUrl: (path) => new URL(path, pluginFolder).href }),
      ),
    },
  ]
  const fake = makeFakeServer()
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, fake.layer]]}>
      <PluginsProvider plugins={plugins}>
        <div style={{ display: "flex", height: 600 }}>
          <Tree label="Files" rows={rows} onToggle={() => undefined} />
        </div>
      </PluginsProvider>
    </RegistryProvider>,
  )
  const icons = () => [...document.querySelectorAll<HTMLImageElement>(".iv-tree__icon img")]
  await expect
    .poll(() => icons().length > 0 && icons().every((img) => img.naturalWidth > 0))
    .toBe(true)
  expect(await scrolledFps()).toBeGreaterThan(MIN_FPS)
})
