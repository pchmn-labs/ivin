import type { BrowserCommand } from "vitest/node"

// Playwright hears late that Vitest swapped in a new iframe for the test file, so the file's
// first action can run in the removed iframe ("Frame was detached") or find none.
export const waitForTestFrame: BrowserCommand<[]> = async ({ page, testPath }) => {
  const deadline = Date.now() + 5000
  for (;;) {
    const frames = page.frames().filter((frame) => frame.name() === "vitest-iframe")
    if (frames.length === 1 && new URL(frames[0].url()).searchParams.get("iframeId") === testPath)
      return
    if (Date.now() > deadline) throw new Error(`Playwright never saw the iframe of ${testPath}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}
