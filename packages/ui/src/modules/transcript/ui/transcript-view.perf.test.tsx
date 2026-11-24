import { RegistryProvider } from "@effect/atom-react"
import { expect, test, vi, type TestContext } from "vitest"
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
const TURNS = 250
const STREAMED_TOKENS = 10_000
const TOKENS_PER_FRAME = 25
const SESSION = "s1"
const TOOL_KINDS: ReadonlyArray<ToolKind> = ["read", "search", "edit", "command"]

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))
const wait150ms = () => new Promise((resolve) => setTimeout(resolve, 150))
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
    `Run the tests with \`pnpm test\`, then read \`packages/ui/src/modules/transcript/ui/turn-${turn}.tsx:42\` and scroll a long session from top to bottom.`,
  ].join("\n\n")

// Eight items a turn: a user message, four tool calls in two steps, and a Markdown answer.
const transcript = (turns: number) => {
  const items: TranscriptItem[] = []
  const images: ImageData[] = []
  const base = (id: string) => itemFields(id, items.length)
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
      steer: false,
    })
    for (let call = 0; call < 4; call++) {
      if (call === 0 || call === 2) {
        items.push({
          ...base(`s${turn}-${call}`),
          type: "message",
          role: "assistant",
          text: call === 0 ? "Looking at the code first." : "Now changing it.",
          images: [],
          steer: false,
        })
      }
      items.push({
        ...base(`c${turn}-${call}`),
        type: "tool_call",
        toolCallId: `c${turn}-${call}`,
        ...(call === 1
          ? { name: "Read", kind: "read", input: { file_path: `packages/ui/src/turn-${turn}.ts` } }
          : {
              name: "Bash",
              kind: TOOL_KINDS[call % TOOL_KINDS.length]!,
              input: {
                command: `rg "transcript" packages/ui/src --glob '*.tsx' -n | head -${call + 10}`,
              },
            }),
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
      steer: false,
    })
  }
  return { items, images }
}

const itemFields = (id: string, position: number) => ({
  id,
  sessionId: SESSION,
  position,
  at: position * 1000,
})

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
  server.seedItems(SESSION, items)
  await render(
    <RegistryProvider
      initialValues={[
        [serverClientLayerAtom, server.layer],
        [foldsOf(SESSION), options.folds ?? new Map()],
      ]}
    >
      <div style={{ position: "relative", height: 800 }}>
        <PluginsProvider plugins={builtinPlugins}>
          <TranscriptView sessionId={SESSION} live={options.live ?? false} />
        </PluginsProvider>
      </div>
    </RegistryProvider>,
  )
  return server
}

const measureFps = async (frames: number, onFrame: (frame: number) => void) => {
  const start = await nextFrame()
  let last = start
  for (let frame = 1; frame <= frames; frame++) {
    onFrame(frame)
    last = await nextFrame()
  }
  return (frames * 1000) / (last - start)
}

// An annotation, not a log: Vitest hides the logs of passing tests, and CI turns it into a notice.
const expectFps = async (annotate: TestContext["annotate"], what: string, fps: number) => {
  await annotate(`${what}: ${fps.toFixed(1)} fps`)
  expect(fps, `${what} ran at ${fps.toFixed(1)} fps`).toBeGreaterThanOrEqual(MIN_FPS)
}

test(
  "scrolling a 2,000-item transcript from top to bottom keeps the frame rate",
  { timeout: 120_000 },
  async ({ annotate }) => {
    const { items, images } = transcript(TURNS)
    expect(items).toHaveLength(2_000)
    // The app shows a message's images from these until the server has written their files.
    rememberSentImages(images)
    const everyThirdTurnUnfolded = new Map(
      Array.from({ length: TURNS }, (_, turn) => [`work:u${turn}`, turn % 3 === 0] as const),
    )
    await mount(items, { folds: everyThirdTurnUnfolded })
    const lastAnswer = page.getByText(`Step ${TURNS - 1}: what changed`)
    await expect.element(lastAnswer).toBeVisible()

    await vi.waitFor(
      async () => {
        scroller().scrollTop = 0
        await wait150ms()
        expect(document.querySelector('[data-row-id="u0"]')).not.toBeNull()
      },
      { timeout: 60_000, interval: 0 },
    )
    const decoded = () =>
      [...document.querySelectorAll<HTMLImageElement>('img[src^="data:image/png"]')].filter(
        (image) => image.naturalWidth > 0,
      )
    await vi.waitFor(() => expect(decoded().length).toBeGreaterThan(0))

    const fps = await measureFps(SCROLL_FRAMES, (frame) => {
      const list = scroller()
      list.scrollTop = ((list.scrollHeight - list.clientHeight) * frame) / SCROLL_FRAMES
    })

    expect(lastAnswer.query()).not.toBeNull()
    await expectFps(annotate, "scrolling", fps)
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
  async ({ annotate }) => {
    const { items } = transcript(25)
    const lastTurn: TranscriptItem = {
      ...itemFields("u-live", items.length),
      type: "message",
      role: "user",
      text: "Explain the whole change, with code",
      images: [],
      steer: false,
    }
    const server = await mount([...items, lastTurn], { live: true })
    await expect.element(page.getByText("Explain the whole change, with code")).toBeVisible()
    await wait150ms()

    const tokens = streamedTokens()
    const frames = Math.ceil(tokens.length / TOKENS_PER_FRAME)
    const fps = await measureFps(frames, (frame) => {
      for (const text of tokens.slice((frame - 1) * TOKENS_PER_FRAME, frame * TOKENS_PER_FRAME)) {
        server.pushChange({
          type: "delta",
          sessionId: SESSION,
          itemId: "a-live",
          position: lastTurn.position + 1,
          kind: "message",
          text,
        })
      }
    })

    // A few frames at most: a backlog drawn after the measure would hide a slow stream.
    await vi.waitFor(
      () => expect(page.getByText("The end of the streamed answer.").query()).not.toBeNull(),
      { timeout: 100, interval: 16 },
    )
    // The view glides to the end over a few frames.
    await expect
      .poll(() => scroller().scrollHeight - scroller().scrollTop - scroller().clientHeight)
      .toBeLessThan(2)
    await expect.element(page.getByText("The end of the streamed answer.")).toBeInViewport()
    await expectFps(annotate, "streaming", fps)
  },
)
