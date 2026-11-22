import { RegistryProvider } from "@effect/atom-react"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { DateTime } from "effect"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../app/builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { type FakeServer, makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { SessionView } from "./session-view.tsx"

const PIXEL =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

const png = (name: string) =>
  new File([Uint8Array.from(atob(PIXEL), (c) => c.charCodeAt(0))], name, { type: "image/png" })

const addSession = (server: FakeServer, id: string, lastImageNumber = 0) => {
  const at = DateTime.makeUnsafe(0)
  server.sessions.set(id, {
    id,
    projectPath: "/p",
    workingFolder: "/p",
    inWorktree: false,
    branch: "main",
    started: true,
    workingFolderDeleted: false,
    title: id,
    harness: "claude",
    model: "sonnet",
    effort: "high",
    permissionMode: "manual",
    relaunchFailure: null,
    pendingMessages: [],
    unreadMessages: [],
    status: "idle",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
    lastImageNumber,
  })
}

const view = (server: FakeServer, sessionId: string) => (
  <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
    <PluginsProvider plugins={builtinPlugins}>
      <SessionView projectPath="/p" sessionId={sessionId} />
    </PluginsProvider>
  </RegistryProvider>
)

const mount = async ({ lastImageNumber = 0 } = {}) => {
  const server = makeFakeServer()
  addSession(server, "s1", lastImageNumber)
  const screen = await render(view(server, "s1"))
  return { server, screen }
}

const field = () => page.getByRole("textbox", { name: "Message" })

const transfer = (files: ReadonlyArray<File>) => {
  const data = new DataTransfer()
  for (const file of files) data.items.add(file)
  return data
}

const paste = (files: ReadonlyArray<File>) =>
  field()
    .element()
    .dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: transfer(files),
        bubbles: true,
        cancelable: true,
      }),
    )

const drop = (files: ReadonlyArray<File>) => {
  const target = field().element()
  const dataTransfer = transfer(files)
  for (const type of ["dragenter", "dragover", "drop"])
    target.dispatchEvent(new DragEvent(type, { dataTransfer, bubbles: true, cancelable: true }))
}

const draftThumbnails = () =>
  page.getByTestId("draft-images").getByRole("button", { name: /View image/ })

test("a pasted image puts its marker at the caret and its thumbnail above the text, and is sent with the message", async () => {
  const { server } = await mount()
  await field().click()
  await userEvent.keyboard("look ")
  paste([png("shot.png")])

  await expect.element(draftThumbnails()).toHaveAccessibleName("View image #1")
  await expect.element(field().getByRole("img", { name: "Image #1" })).toBeVisible()
  await userEvent.keyboard("please")
  await userEvent.keyboard("{Enter}")

  await expect.poll(() => server.sentMessages.at(-1)?.text).toBe("look [Image #1] please")
  expect(server.sentMessages.at(-1)?.images).toEqual([
    { id: expect.any(String), number: 1, mediaType: "image/png", base64: PIXEL },
  ])
  await expect.element(page.getByTestId("draft-images")).not.toBeInTheDocument()
  await expect.element(page.getByRole("button", { name: "View image #1" }).first()).toBeVisible()
})

test("dropped images each get a thumbnail and a marker, numbered after the session's last image", async () => {
  await mount({ lastImageNumber: 4 })
  drop([png("a.png"), png("b.png")])

  await expect.poll(() => draftThumbnails().elements().length).toBe(2)
  await expect.element(field().getByRole("img", { name: "Image #5" })).toBeVisible()
  await expect.element(field().getByRole("img", { name: "Image #6" })).toBeVisible()
})

test("removing a thumbnail takes its marker out of the text", async () => {
  const { server } = await mount()
  await field().click()
  await userEvent.keyboard("before ")
  paste([png("shot.png")])
  await expect.element(draftThumbnails()).toBeVisible()

  await page.getByRole("button", { name: "Remove image #1" }).click()

  await expect.element(page.getByTestId("draft-images")).not.toBeInTheDocument()
  expect(field().getByRole("img").query()).toBeNull()
  await field().click()
  await userEvent.keyboard("{Enter}")
  await expect.poll(() => server.sentMessages.at(-1)?.text).toBe("before ")
  expect(server.sentMessages.at(-1)?.images).toBeUndefined()
})

test("a file that is not an image, or is too large, is refused with a message next to the composer", async () => {
  await mount()
  paste([new File(["%PDF"], "spec.pdf", { type: "application/pdf" })])
  await expect
    .element(page.getByTestId("composer-alert"))
    .toHaveTextContent("spec.pdf is not an image Claude can read. Use PNG, JPEG, GIF or WebP.")

  paste([new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" })])
  await expect
    .element(page.getByTestId("composer-alert"))
    .toHaveTextContent("big.png is 6 MB; Claude takes images up to 5 MB.")
  expect(page.getByTestId("draft-images").query()).toBeNull()
})

test("a draft's images and text survive a session switch", async () => {
  const { server, screen } = await mount()
  addSession(server, "s2")
  await field().click()
  await userEvent.keyboard("keep ")
  paste([png("shot.png")])
  await expect.element(draftThumbnails()).toBeVisible()

  await screen.rerender(view(server, "s2"))
  await expect.element(page.getByTestId("draft-images")).not.toBeInTheDocument()
  await screen.rerender(view(server, "s1"))

  await expect.element(draftThumbnails()).toHaveAccessibleName("View image #1")
  await expect.element(field().getByRole("img", { name: "Image #1" })).toBeVisible()
  expect((field().element() as HTMLElement).innerText).toContain("keep")
})

const seedTranscript = (server: FakeServer) => {
  const message = (
    id: string,
    position: number,
    text: string,
    numbers: number[],
  ): TranscriptItem => ({
    id,
    sessionId: "s1",
    position,
    at: 0,
    type: "message",
    role: "user",
    text,
    images: numbers.map((number) => ({ id: `img-${number}`, number, mediaType: "image/png" })),
    steer: false,
  })
  server.seedItems("s1", [
    message("m1", 0, "the card overflows [Image #1]", [1]),
    message("m2", 1, "a test fails [Image #2] and the chart [Image #3]", [2, 3]),
  ])
}

test("a sent image opens full screen; the arrows move through the session's images and Escape returns to the thumbnail", async () => {
  const server = makeFakeServer()
  addSession(server, "s1", 3)
  seedTranscript(server)
  await render(view(server, "s1"))

  // The bubble shows its thumbnails before the markers in its text.
  const thumbnail = page.getByRole("button", { name: "View image #1" }).first()
  await thumbnail.click()
  const viewer = page.getByRole("dialog")
  await expect.element(viewer.getByRole("heading")).toHaveTextContent("Image #1 · 1 of 3")
  await expect.element(viewer.getByText("From your message: “the card overflows”")).toBeVisible()

  await userEvent.keyboard("{ArrowRight}")
  await expect.element(viewer.getByRole("heading")).toHaveTextContent("Image #2 · 2 of 3")
  await userEvent.keyboard("{ArrowRight}")
  await userEvent.keyboard("{ArrowRight}")
  await expect.element(viewer.getByRole("heading")).toHaveTextContent("Image #3 · 3 of 3")
  await userEvent.keyboard("{ArrowLeft}")
  await expect.element(viewer.getByRole("heading")).toHaveTextContent("Image #2 · 2 of 3")
  await userEvent.keyboard("{ArrowLeft}")

  await userEvent.keyboard("{Escape}")
  await expect.element(viewer).not.toBeInTheDocument()
  await expect.element(thumbnail).toHaveFocus()
})

test("closing the full-screen view on another image puts the focus on that image's thumbnail", async () => {
  const server = makeFakeServer()
  addSession(server, "s1", 3)
  seedTranscript(server)
  await render(view(server, "s1"))

  await page.getByRole("button", { name: "View image #1" }).first().click()
  await expect
    .element(page.getByRole("dialog").getByRole("heading"))
    .toHaveTextContent("Image #1 · 1 of 3")
  await userEvent.keyboard("{ArrowRight}")
  await expect
    .element(page.getByRole("dialog").getByRole("heading"))
    .toHaveTextContent("Image #2 · 2 of 3")
  await userEvent.keyboard("{Escape}")

  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
  await expect.element(page.getByRole("button", { name: "View image #2" }).first()).toHaveFocus()
})

test("the full-screen view draws the images of its strip only as they scroll into view", async () => {
  const server = makeFakeServer()
  addSession(server, "s1", 80)
  const numbers = Array.from({ length: 80 }, (_, i) => i + 1)
  server.seedItems("s1", [
    {
      id: "m1",
      sessionId: "s1",
      position: 0,
      at: 0,
      type: "message",
      role: "user",
      text: numbers.map((n) => `[Image #${n}]`).join(" "),
      images: numbers.map((number) => ({ id: `img-${number}`, number, mediaType: "image/png" })),
      steer: false,
    },
  ])
  await render(view(server, "s1"))

  await page.getByRole("button", { name: "View image #1" }).first().click()
  await expect
    .element(page.getByRole("dialog").getByRole("heading"))
    .toHaveTextContent("Image #1 · 1 of 80")
  await new Promise((resolve) => setTimeout(resolve, 300))

  const strip = page.getByRole("dialog").element().querySelector(".iv-image-viewer__strip")!
  expect(strip.querySelectorAll("button")).toHaveLength(80)
  expect(strip.querySelectorAll("img").length).toBeLessThan(40)
})

test("a marker in a sent message opens its image full screen", async () => {
  const server = makeFakeServer()
  addSession(server, "s1", 3)
  seedTranscript(server)
  await render(view(server, "s1"))

  await page.getByRole("button", { name: "View image #3" }).last().click()
  await expect
    .element(page.getByRole("dialog").getByRole("heading"))
    .toHaveTextContent("Image #3 · 3 of 3")
})

test("a marker in the composer opens the draft's images full screen", async () => {
  await mount()
  paste([png("one.png"), png("two.png")])
  await expect.element(field().getByRole("img", { name: "Image #2" })).toBeVisible()

  await field().getByRole("img", { name: "Image #2" }).click()
  const viewer = page.getByRole("dialog")
  await expect.element(viewer.getByRole("heading")).toHaveTextContent("Image #2 · 2 of 2")
  await expect.element(viewer.getByText("two.png · Not sent yet")).toBeVisible()
})

test("hovering a marker in a sent message shows its image in a preview card", async () => {
  const server = makeFakeServer()
  addSession(server, "s1", 3)
  seedTranscript(server)
  await render(view(server, "s1"))

  await page.getByRole("button", { name: "View image #3" }).last().hover()
  await expect.element(page.getByText("Image #3", { exact: true })).toBeVisible()
  await page.getByText("a test fails", { exact: false }).hover()
  await expect.element(page.getByText("Image #3", { exact: true })).not.toBeInTheDocument()
})
