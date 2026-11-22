import { RegistryProvider } from "@effect/atom-react"
import type { DiffLine } from "@ivin/contracts/file"
import { Effect } from "effect"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { ServerClient, serverClientLayerAtom } from "../../../core/server-client.ts"
import { DiffView } from "./diff-view.tsx"

// Below 30 frames a second, scrolling visibly stutters.
const MIN_FPS = 30
const FRAMES = 120
// Past this, one frame makes the window look frozen.
const MAX_FRAME_MS = 250
const LINES = 10_000

const code = (n: number) =>
  `export const value${n} = compute("${n}", { retries: ${n % 7} }) // ${n}`

// Hunks of 3 context lines around a replaced line and an added one, as an agent's edits look.
const hunks = (() => {
  const result: { header: string; lines: DiffLine[] }[] = []
  let oldLine = 1
  let newLine = 1
  for (let n = 0; n < LINES; n += 8) {
    const lines: DiffLine[] = []
    const context = (k: number) =>
      lines.push({
        kind: "context",
        text: code(n + k),
        oldLine: oldLine++,
        newLine: newLine++,
        changed: null,
      })
    result.push({ header: `@@ -${oldLine},7 +${newLine},8 @@`, lines })
    for (let k = 0; k < 3; k++) context(k)
    lines.push({
      kind: "deleted",
      text: code(n + 3),
      oldLine: oldLine++,
      newLine: null,
      changed: [14, 20],
    })
    lines.push({
      kind: "added",
      text: `${code(n + 3)}!`,
      oldLine: null,
      newLine: newLine++,
      changed: [14, 21],
    })
    lines.push({
      kind: "added",
      text: code(n + 4),
      oldLine: null,
      newLine: newLine++,
      changed: null,
    })
    for (let k = 5; k < 8; k++) context(k)
  }
  return result
})()

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

const longestFrameWhile = async (run: () => Promise<unknown>) => {
  let longest = 0
  let watching = true
  let previous = performance.now()
  const watch = (now: number) => {
    longest = Math.max(longest, now - previous)
    previous = now
    if (watching) requestAnimationFrame(watch)
  }
  requestAnimationFrame(watch)
  await run()
  watching = false
  return longest
}

test("a 10,000-line diff opens without freezing, and scrolls at the frame rate", async () => {
  const server = makeFakeServer()
  const session = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* ServerClient)["session.create"]({ projectPath: "/p" })
    }).pipe(Effect.provide(server.layer)),
  )
  server.diffs.set(`${session.workingFolder}/big.ts`, {
    kind: "text",
    status: "modified",
    hunks,
    added: LINES / 4,
    deleted: LINES / 8,
  })

  const open = async () => {
    await render(
      <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
        <div style={{ display: "flex", height: 600 }}>
          <DiffView
            kind="diff"
            sessionId={session.id}
            workingFolder={session.workingFolder}
            path="big.ts"
            onOpenFile={() => {}}
          />
        </div>
      </RegistryProvider>,
    )
    await expect.element(page.getByText("const").first()).toHaveClass("iv-syntax-keyword")
  }
  expect(await longestFrameWhile(open)).toBeLessThan(MAX_FRAME_MS)

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
