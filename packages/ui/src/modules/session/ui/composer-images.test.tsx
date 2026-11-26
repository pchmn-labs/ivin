import { RegistryContext } from "@effect/atom-react"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { AtomRegistry } from "effect/reactivity"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../core/test-builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { type FakeServer, makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { deletedImageIdsAtom } from "../../transcript/atoms/delete-images.ts"
import { SessionView } from "./session-view.tsx"
import {
  draftThumbnails,
  field,
  mount,
  paste,
  png,
  transfer,
  view,
  addSession,
} from "./test-composer.tsx"

const drop = (files: ReadonlyArray<File>) => {
  const target = field().element()
  const dataTransfer = transfer(files)
  for (const type of ["dragenter", "dragover", "drop"])
    target.dispatchEvent(new DragEvent(type, { dataTransfer, bubbles: true, cancelable: true }))
}

test("dropped images each get a thumbnail and a marker, numbered after the session's last image", async () => {
  await mount({ lastImageNumber: 4 })
  await expect.element(field()).toBeVisible()
  drop([png("a.png"), png("b.png")])

  await expect.poll(() => draftThumbnails().elements().length).toBe(2)
  await expect.element(field().getByRole("img", { name: "Image #5" })).toBeVisible()
  await expect.element(field().getByRole("img", { name: "Image #6" })).toBeVisible()
})

test("a file that is not an image, or is too large, is refused with a message next to the composer", async () => {
  await mount()
  await expect.element(field()).toBeVisible()
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

test("a sent image opens full screen; the arrows move through the session's images and Escape returns to the thumbnail of the image it closes on", async () => {
  const server = makeFakeServer()
  server.openProject("/p")
  addSession(server, "s1", 3)
  seedTranscript(server)
  await render(view(server, "s1"))

  // The bubble shows its thumbnails before the markers in its text.
  await page.getByRole("button", { name: "View image #1" }).first().click()
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

  await userEvent.keyboard("{Escape}")
  await expect.element(viewer).not.toBeInTheDocument()
  await expect.element(page.getByRole("button", { name: "View image #2" }).first()).toHaveFocus()
})

test("the full-screen view draws the images of its strip only as they scroll into view", async () => {
  const server = makeFakeServer()
  server.openProject("/p")
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

  const strip = page.getByRole("dialog").element().querySelector(".iv-image-viewer__strip")!
  await vi.waitFor(() => expect(strip.querySelectorAll("img").length).toBeGreaterThan(0))
  expect(strip.querySelectorAll("button")).toHaveLength(80)
  expect(strip.querySelectorAll("img").length).toBeLessThan(40)
})

test("a deleted image keeps its place in the message and says it was deleted in the full-screen view", async () => {
  const server = makeFakeServer()
  server.openProject("/p")
  addSession(server, "s1", 2)
  server.seedItems("s1", [
    {
      id: "m1",
      sessionId: "s1",
      position: 0,
      at: 0,
      type: "message",
      role: "user",
      text: "the card overflows [Image #1] and [Image #2]",
      images: [
        { id: "img-1", number: 1, mediaType: "image/png", deleted: true },
        { id: "img-2", number: 2, mediaType: "image/png" },
      ],
      steer: false,
    },
  ])
  await render(view(server, "s1"))

  const thumbnail = page.getByRole("button", { name: "Image #1, deleted" }).first()
  await expect.element(thumbnail.getByText("Deleted", { exact: true })).toBeVisible()
  await expect.element(page.getByRole("button", { name: "Image #1, deleted" }).last()).toBeVisible()
  expect(thumbnail.element().querySelector("img")).toBeNull()
  expect(document.querySelector(".iv-message-text")?.textContent).toBe(
    "the card overflows #1 and #2",
  )

  await thumbnail.click()
  const viewer = page.getByRole("dialog")
  await expect.element(viewer.getByRole("heading")).toHaveTextContent("Image #1 · 1 of 2")
  await expect.element(viewer.getByText("Image #1 was deleted")).toBeVisible()
  await userEvent.keyboard("{ArrowRight}")
  await expect.element(viewer.getByRole("heading")).toHaveTextContent("Image #2 · 2 of 2")
  await expect.element(viewer.getByText("Image #1 was deleted")).not.toBeInTheDocument()
})

test("an image deleted from the settings while its transcript is loaded shows as deleted at once", async () => {
  const server = makeFakeServer()
  server.openProject("/p")
  addSession(server, "s1", 3)
  seedTranscript(server)
  const registry = AtomRegistry.make({ initialValues: [[serverClientLayerAtom, server.layer]] })
  await render(
    <RegistryContext.Provider value={registry}>
      <PluginsProvider plugins={builtinPlugins}>
        <SessionView projectPath="/p" sessionId="s1" />
      </PluginsProvider>
    </RegistryContext.Provider>,
  )
  await expect.element(page.getByRole("button", { name: "View image #2" }).first()).toBeVisible()

  registry.set(deletedImageIdsAtom, new Map([["img-2", true]]))

  await expect
    .element(page.getByRole("button", { name: "Image #2, deleted" }).first())
    .toBeVisible()
  await expect.element(page.getByRole("button", { name: "View image #3" }).first()).toBeVisible()
})
