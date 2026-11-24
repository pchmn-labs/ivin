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
import { PAGE_SIZE } from "../atoms/get-items.ts"
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

const message = (position: number, text = `message ${position}`): TranscriptItem => ({
  id: `m${position}`,
  sessionId: "s1",
  position,
  at: 0,
  type: "message",
  role: "assistant",
  text,
  images: [],
  steer: false,
})

const userMessage = (position: number): TranscriptItem => ({
  id: `m${position}`,
  sessionId: "s1",
  position,
  at: 0,
  type: "message",
  role: "user",
  text: `question ${position}`,
  images: [],
  steer: false,
})

const toolCall = (position: number): TranscriptItem => ({
  id: `m${position}`,
  sessionId: "s1",
  position,
  at: 0,
  type: "tool_call",
  toolCallId: `t${position}`,
  name: "Bash",
  kind: "command",
  input: { command: `command ${position}` },
  status: "done",
  output: `output ${position}`,
})

// The browser sends the scroll event once the view has moved, after Virtuoso has seen it.
const scrollEvent = () =>
  new Promise<void>((resolve) =>
    scroller().addEventListener("scroll", () => resolve(), { once: true }),
  )
const topInView = (text: string) =>
  page.getByText(text, { exact: true }).element().getBoundingClientRect().top -
  scroller().getBoundingClientRect().top
const fromEnd = () => scroller().scrollHeight - scroller().clientHeight - scroller().scrollTop
const inView = (text: string) => {
  const top = topInView(text)
  return top >= 0 && top < scroller().clientHeight
}

// The seeded history is a turn that has ended; the session runs from the message the test sends.
const sessionView = (server: ReturnType<typeof makeFakeServer>, height: number, live: boolean) => (
  <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
    <div style={{ position: "relative", height }}>
      <PluginsProvider plugins={builtinPlugins}>
        <TranscriptView sessionId="s1" live={live} />
      </PluginsProvider>
    </div>
  </RegistryProvider>
)

const longAnswer = (position: number, lines = 30) =>
  message(position, Array.from({ length: lines }, (_, i) => `line ${i}`).join("\n\n"))

const sendQuestion = async (server: ReturnType<typeof makeFakeServer>) => {
  server.seedItems("s1", [userMessage(0), ...Array.from({ length: 39 }, (_, i) => message(i + 1))])
  const screen = await render(sessionView(server, 300, false))
  await expect.element(page.getByText("message 39", { exact: true })).toBeVisible()
  server.pushItem(userMessage(40))
  await expect.element(page.getByText("question 40", { exact: true })).toBeVisible()
  await screen.rerender(sessionView(server, 300, true))
  return screen
}

test("while the agent works, the transcript follows the end of its turn, however long", async () => {
  const server = makeFakeServer()
  await sendQuestion(server)

  server.pushItem(toolCall(41))
  server.pushItem(longAnswer(42))
  await expect.element(page.getByText("line 29", { exact: true })).toBeInTheDocument()
  await expect.poll(fromEnd).toBeLessThan(2)
  expect(
    page.getByText("question 40", { exact: true }).query() !== null && inView("question 40"),
  ).toBe(false)

  server.pushItem(toolCall(43))
  await expect.element(page.getByText("command 43")).toBeInTheDocument()
  await expect.poll(fromEnd).toBeLessThan(2)
})

const everyFrame = <T,>(read: (frame: number) => T, done: (seen: T[]) => boolean) =>
  new Promise<T[]>((resolve) => {
    const seen: T[] = []
    const step = () => {
      seen.push(read(seen.length))
      if (done(seen)) resolve(seen)
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })

const streamLine = (index: number) =>
  ({
    type: "delta",
    sessionId: "s1",
    itemId: "m42",
    position: 42,
    kind: "message",
    text: `line ${index}\n\n`,
  }) as const

test("while the answer streams in fast, its last line stays in view", async () => {
  const server = makeFakeServer()
  await sendQuestion(server)
  server.pushItem(toolCall(41))
  await expect.poll(fromEnd).toBeLessThan(2)

  const lags = await everyFrame(
    (frame) => {
      server.pushChange(streamLine(frame))
      return fromEnd()
    },
    (seen) => seen.length === 40,
  )

  expect(Math.max(...lags)).toBeLessThan(80)
})

test("while the answer streams in, the view moves at a steady pace", async () => {
  const server = makeFakeServer()
  await sendQuestion(server)
  server.pushItem(toolCall(41))
  await expect.poll(fromEnd).toBeLessThan(2)

  const seen = await everyFrame(
    (frame) => {
      if (frame % 8 === 0) server.pushChange(streamLine(frame / 8))
      return { at: performance.now(), top: scroller().scrollTop }
    },
    (frames) => frames.length === 160,
  )

  // Frames do not all last as long, so the pace is read in pixels per millisecond.
  const paces = seen
    .slice(41)
    .map(({ at, top }, index) => (top - seen[40 + index]!.top) / (at - seen[40 + index]!.at))
  const median = paces.toSorted((a, b) => a - b)[paces.length >> 1]!
  const steady = paces.filter((pace) => pace > median / 1.5 && pace < median * 1.5)
  expect(steady.length).toBeGreaterThan(0.8 * paces.length)
})

const messageRowTop = () => {
  const row = document.querySelector('[data-row-id="m40"]')
  return row && Math.round(row.getBoundingClientRect().top - scroller().getBoundingClientRect().top)
}

test("a turn that ends with a long answer moves its message to the top of the view in one step", async () => {
  const server = makeFakeServer()
  const screen = await sendQuestion(server)
  for (let position = 41; position < 47; position++) server.pushItem(toolCall(position))
  server.pushItem(longAnswer(47))
  await expect.poll(fromEnd).toBeLessThan(2)

  void screen.rerender(sessionView(server, 300, false))
  const frames = await everyFrame(
    // Read cheaply, or the frames between Virtuoso's corrections are not seen.
    () => ({ top: messageRowTop(), answer: document.querySelector('[data-row-id="m47"]') }),
    (seen) => Math.abs(seen.at(-1)!.top ?? Number.POSITIVE_INFINITY) < 2,
  )

  // Before the turn ends, its message is above the view and not drawn.
  const ended = frames.filter((frame) => frame.top !== null)
  expect(ended).toHaveLength(1)
  expect(ended[0]!.answer).not.toBeNull()
  expect(fromEnd()).toBeGreaterThan(100)
})

test("a turn that ends with a short answer stays at the end, its message in view", async () => {
  const server = makeFakeServer()
  const screen = await sendQuestion(server)
  server.pushItem(toolCall(41))
  server.pushItem(message(42))
  await expect.element(page.getByText("message 42", { exact: true })).toBeVisible()

  void screen.rerender(sessionView(server, 300, false))
  const lags = await everyFrame(fromEnd, () => messageRowTop() !== null)

  expect(Math.max(...lags)).toBeLessThan(2)
  expect(inView("question 40")).toBe(true)
})

test("scrolled up while the agent works, the transcript stays put", async () => {
  const server = makeFakeServer()
  await sendQuestion(server)
  server.pushItem(longAnswer(41))
  await expect.poll(fromEnd).toBeLessThan(2)

  const scrolled = scrollEvent()
  scroller().dispatchEvent(new WheelEvent("wheel", { deltaY: -200 }))
  scroller().scrollTop -= 200
  await scrolled
  const scrolledUpTo = scroller().scrollTop
  const heightBefore = scroller().scrollHeight
  server.pushItem(longAnswer(42))
  await expect.poll(() => scroller().scrollHeight).toBeGreaterThan(heightBefore)
  expect(scroller().scrollTop).toBe(scrolledUpTo)
})

test("scrolled back to the end, the transcript follows its end again", async () => {
  const server = makeFakeServer()
  await sendQuestion(server)
  server.pushItem(longAnswer(41))
  await expect.poll(fromEnd).toBeLessThan(2)
  const scrolled = scrollEvent()
  scroller().dispatchEvent(new WheelEvent("wheel", { deltaY: -200 }))
  scroller().scrollTop -= 200
  await scrolled

  await vi.waitFor(() => {
    scroller().scrollTop = scroller().scrollHeight
    scroller().dispatchEvent(new Event("scroll"))
    expect(fromEnd()).toBeLessThan(2)
  })
  server.pushItem(message(42))
  await expect.element(page.getByText("message 42", { exact: true })).toBeVisible()
  await expect.poll(fromEnd).toBeLessThan(2)
})

const thinking = (position: number): TranscriptItem => ({
  id: `m${position}`,
  sessionId: "s1",
  position,
  at: 0,
  type: "thinking",
  text: "thinking",
})

// Its steps fold into fewer rows than fill the view.
const longTurn = (): TranscriptItem[] => [
  userMessage(0),
  message(1),
  userMessage(2),
  ...Array.from({ length: 3 * PAGE_SIZE + 30 }, (_, i) =>
    [message, thinking, toolCall, toolCall, toolCall][i % 5]!(i + 3),
  ),
]

test.each([true, false])(
  "scrolling up a turn of several pages reaches its message and the turn before (live: %s)",
  async (live) => {
    const server = makeFakeServer()
    server.seedItems("s1", longTurn())

    await render(
      <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
        <div style={{ position: "relative", height: 900 }}>
          <PluginsProvider plugins={builtinPlugins}>
            <TranscriptView sessionId="s1" live={live} />
          </PluginsProvider>
        </div>
      </RegistryProvider>,
    )
    await expect.element(page.getByTestId("transcript-work")).toBeInTheDocument()

    await vi.waitFor(() => {
      scroller().scrollTop = 0
      expect(page.getByText("question 2", { exact: true }).query()).not.toBeNull()
      expect(page.getByText("question 0", { exact: true }).query()).not.toBeNull()
    })
  },
)
