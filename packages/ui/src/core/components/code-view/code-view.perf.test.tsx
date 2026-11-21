import { FILE_SIZE_LIMIT } from "@ivin/contracts/file"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { CodeView } from "./code-view.tsx"

// Below 30 frames a second, scrolling visibly stutters.
const MIN_FPS = 30
const FRAMES = 120
// The longest frame while the file opens and highlights; past this the window looks frozen.
const MAX_FRAME_MS = 250

const line = (n: number) =>
  `export const value${n} = compute("${n}", { retries: ${n % 7} }) // ${n}\n`
const text = (() => {
  let out = ""
  for (let n = 0; out.length < FILE_SIZE_LIMIT - 200; n++) out += line(n)
  return out
})()

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

test("a TypeScript file at the size limit opens without freezing, and scrolls at the frame rate", async () => {
  let longest = 0
  let watching = true
  let previous = performance.now()
  const watch = (now: number) => {
    longest = Math.max(longest, now - previous)
    previous = now
    if (watching) requestAnimationFrame(watch)
  }
  requestAnimationFrame(watch)
  await render(
    <div style={{ display: "flex", height: 600 }}>
      <CodeView text={text} fileName="big.ts" />
    </div>,
  )
  await expect.element(page.getByText("value0", { exact: false })).toBeVisible()
  await expect.element(page.getByText("const").first()).toHaveClass("iv-syntax-keyword")
  watching = false
  expect(longest).toBeLessThan(MAX_FRAME_MS)

  const scroller = document.querySelector<HTMLElement>(".cm-scroller")!
  const step = (scroller.scrollHeight - scroller.clientHeight) / FRAMES
  const start = await nextFrame()
  let last = start
  for (let frame = 1; frame <= FRAMES; frame++) {
    scroller.scrollTop = step * frame
    last = await nextFrame()
  }

  expect(scroller.scrollTop).toBeGreaterThan(100_000)
  const fps = (FRAMES * 1000) / (last - start)
  expect(fps).toBeGreaterThan(MIN_FPS)
})
