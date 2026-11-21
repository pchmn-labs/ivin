import { RegistryProvider } from "@effect/atom-react"
import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ImageData, ToolKind, TranscriptItem } from "@ivin/contracts/transcript"
import { builtinPlugins } from "../../../app/builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { foldsOf } from "../atoms/folds.ts"
import { rememberSentImages } from "../atoms/sent-images.ts"
import { TranscriptView } from "./transcript-view.tsx"

// Below 30 frames a second, the transcript visibly stutters; headless Chromium caps rAF at 60.
const MIN_FPS = 30
const SCROLL_FRAMES = 120
const STREAMED_TOKENS = 10_000
const TOKENS_PER_FRAME = 25
const KINDS: ReadonlyArray<ToolKind> = ["read", "search", "edit", "command"]

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))
const settle = () => new Promise((resolve) => setTimeout(resolve, 150))
const scroller = () => document.querySelector<HTMLElement>('[data-testid="transcript"]')!

const answer = (turn: number) =>
  [
    `## Step ${turn}: what changed`,
    `The transcript keeps every row in an atom of its own, so turn ${turn} only re-renders the rows it touches. The rest of this answer walks through the change, the reasons behind it, and how to check it by hand before merging.`,
    "- The list holds ids, and each item reads its own atom.\n- Deltas are coalesced per frame before they reach the atoms.\n- Finished Markdown blocks are memoised.",
    "```ts",
    `export const turn${turn} = (items: ReadonlyArray<Item>) =>`,
    "  items",
    '    .filter((item) => item.type === "message")',
    "    .map((item) => ({ id: item.id, text: item.text.trim() }))",
    "    .reduce((rows, row) => [...rows, row], [] as Row[])",
    "```",
    "Run the tests with `pnpm test`, then open a long session and scroll it from top to bottom.",
  ].join("\n\n")

// 2,000 items: 250 turns of a user message, four tool calls in two steps, and a Markdown answer.
const transcript = (turns: number) => {
  const items: TranscriptItem[] = []
  const images: ImageData[] = []
  const base = (id: string) => ({
    id,
    sessionId: "s1",
    position: items.length,
    at: items.length * 1000,
  })
  for (let turn = 0; turn < turns; turn++) {
    const image =
      turn % 6 === 0
        ? { id: `img-${turn}`, number: images.length + 1, mediaType: "image/png" as const }
        : null
    if (image) images.push({ ...image, base64: pngBase64(image.number) })
    items.push({
      ...base(`u${turn}`),
      type: "message",
      role: "user",
      text: image
        ? `Here is what turn ${turn} looks like [Image #${image.number}], fix the spacing`
        : `Question ${turn}: why does the list jump when a row grows?`,
      images: image ? [image] : [],
    })
    for (let call = 0; call < 4; call++) {
      if (call === 0 || call === 2) {
        items.push({
          ...base(`s${turn}-${call}`),
          type: "message",
          role: "assistant",
          text: call === 0 ? "Looking at the code first." : "Now changing it.",
          images: [],
        })
      }
      items.push({
        ...base(`c${turn}-${call}`),
        type: "tool_call",
        toolCallId: `c${turn}-${call}`,
        name: "Bash",
        kind: KINDS[call % KINDS.length]!,
        input: {
          command: `rg "transcript" packages/ui/src --glob '*.tsx' -n | head -${call + 10}`,
        },
        status: "done",
        output: `packages/ui/src/modules/transcript/ui/transcript-view.tsx:${call + 1}: match`,
      })
    }
    items.push({
      ...base(`a${turn}`),
      type: "message",
      role: "assistant",
      text: answer(turn),
      images: [],
    })
  }
  return { items, images }
}

const pngBase64 = (number: number) => {
  const canvas = document.createElement("canvas")
  canvas.width = 960
  canvas.height = 600
  const context = canvas.getContext("2d")!
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, `hsl(${(number * 47) % 360} 60% 40%)`)
  gradient.addColorStop(1, `hsl(${(number * 47 + 120) % 360} 60% 60%)`)
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = "white"
  context.font = "96px sans-serif"
  context.fillText(`#${number}`, 80, 300)
  return canvas.toDataURL("image/png").slice("data:image/png;base64,".length)
}

const mount = async (
  items: ReadonlyArray<TranscriptItem>,
  options: { live?: boolean; folds?: ReadonlyMap<string, boolean> } = {},
) => {
  await page.viewport(1280, 800)
  const server = makeFakeServer()
  server.seedItems("s1", items)
  await render(
    <RegistryProvider
      initialValues={[
        [serverClientLayerAtom, server.layer],
        [foldsOf("s1"), options.folds ?? new Map()],
      ]}
    >
      <div style={{ position: "relative", height: 800 }}>
        <PluginsProvider plugins={builtinPlugins}>
          <TranscriptView sessionId="s1" live={options.live ?? false} />
        </PluginsProvider>
      </div>
    </RegistryProvider>,
  )
  return server
}

const fpsOver = (frames: number, start: number, end: number) => (frames * 1000) / (end - start)

test(
  "scrolling a 2,000-item transcript from top to bottom keeps the frame rate",
  { timeout: 120_000 },
  async () => {
    const { items, images } = transcript(250)
    expect(items).toHaveLength(2_000)
    // The app shows a message's images from these until the server has written their files.
    rememberSentImages(images)
    const unfolded = new Map(
      Array.from({ length: 250 }, (_, turn) => [`work:u${turn}`, turn % 3 === 0] as const),
    )
    await mount(items, { folds: unfolded })
    await expect.element(page.getByText("Step 249: what changed")).toBeVisible()

    await vi.waitFor(
      async () => {
        scroller().scrollTop = 0
        await settle()
        expect(document.querySelector('[data-row-id="u0"]')).not.toBeNull()
      },
      { timeout: 60_000, interval: 0 },
    )
    const decoded = () =>
      [...document.querySelectorAll<HTMLImageElement>('img[src^="data:image/png"]')].filter(
        (image) => image.naturalWidth > 0,
      )
    await vi.waitFor(() => expect(decoded().length).toBeGreaterThan(0))

    const start = await nextFrame()
    let last = start
    for (let frame = 1; frame <= SCROLL_FRAMES; frame++) {
      const list = scroller()
      list.scrollTop = ((list.scrollHeight - list.clientHeight) * frame) / SCROLL_FRAMES
      last = await nextFrame()
    }
    const fps = fpsOver(SCROLL_FRAMES, start, last)
    console.info(`transcript scroll: ${fps.toFixed(1)} fps`)

    expect(page.getByText("Step 249: what changed").query()).not.toBeNull()
    expect(fps, `scrolling ran at ${fps.toFixed(1)} fps`).toBeGreaterThan(MIN_FPS)
  },
)

// Whole answers, so the stream never ends inside a code block; a word and its space is one token.
const streamedTokens = () => {
  const tokens: string[] = []
  for (let section = 0; tokens.length < STREAMED_TOKENS; section++) {
    tokens.push(...`${answer(section)}\n\n`.split(/(?<=\s)/))
  }
  tokens.push("The end of the streamed answer.")
  return tokens
}

test(
  "streaming a 10,000-token answer while the view follows it keeps the frame rate",
  { timeout: 120_000 },
  async () => {
    const { items } = transcript(25)
    const lastTurn: TranscriptItem = {
      id: "u-live",
      sessionId: "s1",
      position: items.length,
      at: items.length * 1000,
      type: "message",
      role: "user",
      text: "Explain the whole change, with code",
      images: [],
    }
    const server = await mount([...items, lastTurn], { live: true })
    await expect.element(page.getByText("Explain the whole change, with code")).toBeVisible()
    await settle()

    const tokens = streamedTokens()
    const frames = Math.ceil(tokens.length / TOKENS_PER_FRAME)
    const start = await nextFrame()
    let last = start
    for (let frame = 0; frame < frames; frame++) {
      for (const text of tokens.slice(frame * TOKENS_PER_FRAME, (frame + 1) * TOKENS_PER_FRAME)) {
        server.pushChange({
          type: "delta",
          sessionId: "s1",
          itemId: "a-live",
          position: lastTurn.position + 1,
          kind: "message",
          text,
        })
      }
      last = await nextFrame()
    }
    const fps = fpsOver(frames, start, last)
    console.info(`transcript stream: ${fps.toFixed(1)} fps`)

    await expect.element(page.getByText("The end of the streamed answer.")).toBeInViewport()
    expect(fps, `streaming ran at ${fps.toFixed(1)} fps`).toBeGreaterThan(MIN_FPS)
  },
)
