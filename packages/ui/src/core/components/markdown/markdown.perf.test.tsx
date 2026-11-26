import { expect, test, type TestContext } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Markdown } from "./markdown.tsx"

// Below 30 frames a second, streaming visibly stutters.
const MIN_FPS = 30
const CODE_LINES = 3000
const LINES_PER_FRAME = 25

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

const codeLine = (n: number) => `const value${n} = compute("${n}", { retries: ${n % 7} }) // ${n}`

const Stream = ({ lines }: { lines: number }) => (
  <Markdown
    text={`Here is the code:\n\n\`\`\`ts\n${Array.from({ length: lines }, (_, n) => codeLine(n)).join("\n")}`}
  />
)

test(
  "streaming a 3,000-line code block that is not closed yet keeps the frame rate",
  { timeout: 120_000 },
  async ({ annotate }: TestContext) => {
    const screen = await render(<Stream lines={1} />)
    await expect.element(page.getByText("Here is the code:")).toBeVisible()

    const frames = CODE_LINES / LINES_PER_FRAME
    const start = await nextFrame()
    let last = start
    for (let frame = 1; frame <= frames; frame++) {
      await screen.rerender(<Stream lines={frame * LINES_PER_FRAME} />)
      last = await nextFrame()
    }
    const fps = (frames * 1000) / (last - start)

    await annotate(`streaming a code block: ${fps.toFixed(1)} fps`)
    expect(fps, `streaming a code block ran at ${fps.toFixed(1)} fps`).toBeGreaterThanOrEqual(
      MIN_FPS,
    )
    expect(document.body.textContent).toContain(codeLine(CODE_LINES - 1))
  },
)
