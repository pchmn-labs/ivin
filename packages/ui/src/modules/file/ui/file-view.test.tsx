import { RegistryProvider } from "@effect/atom-react"
import { Effect } from "effect"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { ServerClient, serverClientLayerAtom } from "../../../core/server-client.ts"
import { FileView } from "./file-view.tsx"

const mount = async (text: string) => {
  const server = makeFakeServer()
  server.openProject("/p")
  const session = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* ServerClient)["session.create"]({ projectPath: "/p" })
    }).pipe(Effect.provide(server.layer)),
  )
  const file = `${session.workingFolder}/a.txt`
  server.files.set(file, { kind: "text", text })
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ display: "flex", height: 300 }}>
        <FileView sessionId={session.id} workingFolder={session.workingFolder} path="a.txt" />
      </div>
    </RegistryProvider>,
  )
  const changeOnDisk = (next: string, paths = ["a.txt"]) => {
    server.files.set(file, { kind: "text", text: next })
    server.changeOnDisk(session.workingFolder, paths)
  }
  return { server, changeOnDisk }
}

test("an open file with no edits shows what the agent wrote, and the cursor stays on its line", async () => {
  const { server, changeOnDisk } = await mount("one\ntwo\nthree\nfour")
  await vi.waitFor(() => expect(server.callsOf("file.watch")).toBe(1))
  await page.getByText("two").click()

  changeOnDisk("zero\none\ntwo\nthree\nfour")

  await expect.element(page.getByText("zero")).toBeVisible()
  expect(document.querySelector(".cm-activeLine")?.textContent).toBe("two")
})

test("an open file with unsaved edits shows the changed-on-disk bar without a tab switch", async () => {
  const { changeOnDisk } = await mount("one")
  await page.getByText("one").click()
  await userEvent.keyboard("x")

  changeOnDisk("agent")

  await expect
    .element(
      page.getByRole("alert").getByText("a.txt changed on disk while you had unsaved edits."),
    )
    .toBeVisible()
})

test("a change to another file does not read the open one again", async () => {
  const { server, changeOnDisk } = await mount("one")
  await vi.waitFor(() => expect(server.callsOf("file.watch")).toBe(1))
  await expect.element(page.getByText("one")).toBeVisible()

  changeOnDisk("other", ["b.txt"])
  changeOnDisk("again")

  await expect.element(page.getByText("again")).toBeVisible()
  expect(server.callsOf("file.readFile")).toBe(2)
})
