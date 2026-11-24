import { RegistryProvider } from "@effect/atom-react"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { builtinPlugins } from "../../../app/builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { TranscriptView } from "./transcript-view.tsx"

const fields = (position: number) => ({
  id: `i${position}`,
  sessionId: "s1",
  position,
  at: 0,
})

const URL_TEXT = `See https://example.com/${"segment/".repeat(30)}index.html?${"q=value&".repeat(20)}`
const LONG_PATH = `/Users/aleksandra/Dev/northwind-industries-holdings/${"packages/".repeat(12)}transcript-view.tsx`
const LONG_OUTPUT_LINE = `${"0123456789abcdef".repeat(60)}`

const items: ReadonlyArray<TranscriptItem> = [
  { ...fields(0), type: "message", role: "user", text: URL_TEXT, images: [], steer: false },
  {
    ...fields(1),
    type: "message",
    role: "assistant",
    text: `Here is a minified line:\n\n\`\`\`js\n${LONG_OUTPUT_LINE}\n\`\`\`\n\n| a | b |\n|---|---|\n| ${LONG_PATH} | ${URL_TEXT} |`,
    images: [],
    steer: false,
  },
  {
    ...fields(2),
    type: "tool_call",
    toolCallId: "t2",
    name: "Bash",
    kind: "command",
    input: { command: `cat ${LONG_PATH} | grep ${LONG_OUTPUT_LINE}` },
    status: "done",
    output: `${LONG_OUTPUT_LINE}\n${Array.from({ length: 3000 }, (_, n) => `line ${n}`).join("\n")}`,
  },
  {
    ...fields(3),
    type: "tool_call",
    toolCallId: "t3",
    name: "Read",
    kind: "read",
    input: { file_path: LONG_PATH },
    status: "done",
    output: "x",
  },
  {
    ...fields(4),
    type: "tool_call",
    toolCallId: "t4",
    name: "Edit",
    kind: "edit",
    input: { file_path: LONG_PATH, old_string: LONG_OUTPUT_LINE, new_string: "a" },
    status: "done",
    output: "ok",
  },
  { ...fields(5), type: "message", role: "assistant", text: "Done.", images: [], steer: false },
]

test("a transcript of long unbroken text, paths and output does not scroll sideways", async () => {
  await page.viewport(900, 700)
  const server = makeFakeServer()
  server.seedItems("s1", items)
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ position: "relative", height: 700 }}>
        <PluginsProvider plugins={builtinPlugins}>
          <TranscriptView sessionId="s1" />
        </PluginsProvider>
      </div>
    </RegistryProvider>,
  )
  await expect.element(page.getByText("Done.", { exact: true })).toBeVisible()
  const scroller = document.querySelector<HTMLElement>('[data-testid="transcript"]')!
  const wide = [...scroller.querySelectorAll<HTMLElement>("*")]
    .filter(
      (el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "visible",
    )
    .map((el) => `${el.tagName}.${el.className}`)
  expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth)
  expect(wide).toEqual([])
})
