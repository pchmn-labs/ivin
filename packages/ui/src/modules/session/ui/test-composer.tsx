import { RegistryProvider } from "@effect/atom-react"
import { expect } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../core/test-builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { type FakeServer, makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { SessionView } from "./session-view.tsx"

export const PIXEL =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

export const png = (name: string) =>
  new File([Uint8Array.from(atob(PIXEL), (c) => c.charCodeAt(0))], name, { type: "image/png" })

export const addSession = (server: FakeServer, id: string, lastImageNumber = 0) => {
  server.sessions.set(id, makeTestSession({ id, title: id, lastImageNumber }))
}

export const view = (server: FakeServer, sessionId: string) => (
  <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
    <PluginsProvider plugins={builtinPlugins}>
      <SessionView projectPath="/p" sessionId={sessionId} />
    </PluginsProvider>
  </RegistryProvider>
)

export const mount = async ({ lastImageNumber = 0 } = {}) => {
  const server = makeFakeServer()
  server.openProject("/p")
  addSession(server, "s1", lastImageNumber)
  const screen = await render(view(server, "s1"))
  // The field shows before it has the session's image limit and numbers; the menu shows with them.
  await expect.element(page.getByRole("button", { name: /^Run options/ })).toBeVisible()
  return { server, screen }
}

export const field = () => page.getByRole("textbox", { name: "Message" })

export const transfer = (files: ReadonlyArray<File>) => {
  const data = new DataTransfer()
  for (const file of files) data.items.add(file)
  return data
}

export const paste = (files: ReadonlyArray<File>) =>
  field()
    .element()
    .dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: transfer(files),
        bubbles: true,
        cancelable: true,
      }),
    )

export const draftThumbnails = () =>
  page.getByTestId("draft-images").getByRole("button", { name: /View image/ })
