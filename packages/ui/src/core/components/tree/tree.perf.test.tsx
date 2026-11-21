import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { TreeRow } from "@ivin/plugin-api/ui"
import { Tree } from "./tree.tsx"

// Below 30 frames a second, scrolling the tree visibly stutters.
const MIN_FPS = 30
const FRAMES = 120

// 50 open folders of 100 files each.
const rows: ReadonlyArray<TreeRow> = Array.from({ length: 50 }, (_, folder) => [
  { id: `f${folder}`, name: `folder-${folder}`, depth: 0, expanded: true },
  ...Array.from({ length: 100 }, (_, file) => ({
    id: `f${folder}/${file}`,
    name: `component-${folder}-${file}.tsx`,
    depth: 1,
    expanded: null,
  })),
]).flat()

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

test("scrolling a 5,000-file tree keeps the frame rate", async () => {
  await render(
    <div style={{ display: "flex", height: 600 }}>
      <Tree label="Files" rows={rows} onToggle={() => undefined} />
    </div>,
  )
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
  const fps = (FRAMES * 1000) / (last - start)
  expect(fps).toBeGreaterThan(MIN_FPS)
})
