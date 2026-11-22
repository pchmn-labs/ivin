import { RegistryProvider } from "@effect/atom-react"
import { FILE_SIZE_LIMIT } from "@ivin/contracts/file"
import { Effect } from "effect"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { ServerClient, serverClientLayerAtom } from "../../../core/server-client.ts"
import { FileView } from "./file-view.tsx"

// Below 30 frames a second, typing visibly lags.
const MAX_FRAME_MS = 1000 / 30
const KEYS = 40

const line = (n: number) =>
  `export const value${n} = compute("${n}", { retries: ${n % 7} }) // ${n}\n`
const text = (() => {
  let out = ""
  for (let n = 0; out.length < FILE_SIZE_LIMIT - 200; n++) out += line(n)
  return out
})()

test("typing in a file at the size limit keeps up with the frame rate", async () => {
  const server = makeFakeServer()
  const session = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* ServerClient)["session.create"]({ projectPath: "/p" })
    }).pipe(Effect.provide(server.layer)),
  )
  server.files.set(`${session.workingFolder}/big.ts`, { kind: "text", text })
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ display: "flex", height: 600 }}>
        <FileView sessionId={session.id} workingFolder={session.workingFolder} path="big.ts" />
      </div>
    </RegistryProvider>,
  )
  await expect.element(page.getByText("const").first()).toHaveClass("iv-syntax-keyword")
  await page.elementLocator(document.querySelectorAll(".cm-line")[3]!).click()
  await userEvent.keyboard("{End}")

  let longest = 0
  let watching = true
  let previous = performance.now()
  const watch = (now: number) => {
    longest = Math.max(longest, now - previous)
    previous = now
    if (watching) requestAnimationFrame(watch)
  }
  requestAnimationFrame(watch)
  for (let key = 0; key < KEYS; key++) await userEvent.keyboard("x")
  watching = false

  await expect.element(page.getByText(`// 3${"x".repeat(KEYS)}`)).toBeVisible()
  expect(longest).toBeLessThan(MAX_FRAME_MS)
})
