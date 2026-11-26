import { RegistryProvider } from "@effect/atom-react"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../core/test-builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { type FakeServer, makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { SessionView } from "./session-view.tsx"

const reads: Array<{ resolve: (base64: string) => void }> = []
vi.mock("../adapters/read-image-file.ts", () => ({
  readImageFile: () => new Promise<string>((resolve) => reads.push({ resolve })),
}))

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
    backgroundTasks: [],
    status: "idle",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
    lastImageNumber,
    waitingFor: null,
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
  server.openProject("/p")
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

const draftThumbnails = () =>
  page.getByTestId("draft-images").getByRole("button", { name: /View image/ })

test("two images pasted before either is read take the numbers #1 and #2", async () => {
  reads.length = 0
  await mount()
  await field().click()
  paste([png("a.png")])
  paste([png("b.png")])
  await vi.waitFor(() => expect(reads.length).toBe(2))
  for (const read of reads) read.resolve(PIXEL)

  await expect.element(field().getByRole("img", { name: "Image #1" })).toBeVisible()
  await expect.element(field().getByRole("img", { name: "Image #2" })).toBeVisible()
})

test("an image that finishes reading after its tab was left is in the field, marker at the end, when the user comes back", async () => {
  reads.length = 0
  const { server, screen } = await mount()
  await field().click()
  await userEvent.keyboard("look")
  paste([png("a.png")])
  await vi.waitFor(() => expect(reads.length).toBe(1))
  addSession(server, "s2")
  await screen.rerender(view(server, "s2"))
  reads[0]?.resolve(PIXEL)
  await screen.rerender(view(server, "s1"))

  await expect.element(draftThumbnails()).toHaveAccessibleName("View image #1")
  await expect.element(field().getByRole("img", { name: "Image #1" })).toBeVisible()
  await expect.element(field()).toHaveTextContent("look #1")
})
