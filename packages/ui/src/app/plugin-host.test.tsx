import { RegistryProvider } from "@effect/atom-react"
import { Effect } from "effect"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { keymap } from "@ivin/plugin-api/editor"
import { defineUi, useAnnotations } from "@ivin/plugin-api/ui"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { ServerClient, serverClientLayerAtom } from "../core/server-client.ts"
import { FileView } from "../modules/file/ui/file-view.tsx"
import type { UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"
import { PluginsProvider } from "./plugin-host.tsx"
import { Slot } from "./slot-renderer.tsx"

function Notes({ sessionId }: { sessionId: string }) {
  const notes = useAnnotations(sessionId, "note")
  return <span>{notes.length ? notes.map((note) => String(note.data)).join(",") : "none"}</span>
}

const notes: UiPluginEntry = {
  manifest: { id: "notes" },
  activate: defineUi((ctx) => ctx.slots.add("composer.status", Notes)),
}

test("useAnnotations shows a session's annotations of a kind as they are added and removed", async () => {
  const server = makeFakeServer()
  const call = <A, E>(rpc: (client: ServerClient["Service"]) => Effect.Effect<A, E>) =>
    Effect.runPromise(
      Effect.gen(function* () {
        return yield* rpc(yield* ServerClient)
      }).pipe(Effect.provide(server.layer)),
    )
  const session = await call((client) => client["session.create"]({ projectPath: "/p" }))
  const target = { _tag: "session", sessionId: session.id } as const
  await call((client) =>
    client["annotation.add"]({ target, ns: "cli", kind: "todo", data: "not a note" }),
  )

  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={[notes]}>
        <Slot slot="composer.status" props={{ sessionId: session.id }} />
      </PluginsProvider>
    </RegistryProvider>,
  )
  await expect.element(page.getByText("none")).toBeVisible()

  const added = await call((client) =>
    client["annotation.add"]({ target, ns: "cli", kind: "note", data: "hi" }),
  )
  await expect.element(page.getByText("hi")).toBeVisible()

  await call((client) => client["annotation.remove"]({ id: added.id }))
  await expect.element(page.getByText("none")).toBeVisible()
})

test("an editorExtensions contribution takes effect in the editor of an open file", async () => {
  const server = makeFakeServer()
  const session = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* ServerClient)["session.create"]({ projectPath: "/p" })
    }).pipe(Effect.provide(server.layer)),
  )
  server.files.set(`${session.workingFolder}/notes.md`, { kind: "text", text: "hello" })
  const shout: UiPluginEntry = {
    manifest: { id: "shout" },
    activate: defineUi((ctx) =>
      ctx.editorExtensions.add(
        keymap.of([
          {
            key: "Alt-u",
            run: (view) => {
              view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "HELLO" } })
              return true
            },
          },
        ]),
      ),
    ),
  }

  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={[shout]}>
        <div style={{ height: 300, display: "flex" }}>
          <FileView sessionId={session.id} workingFolder={session.workingFolder} path="notes.md" />
        </div>
      </PluginsProvider>
    </RegistryProvider>,
  )
  const editor = page.getByRole("textbox", { name: "notes.md" })
  await editor.click()
  await userEvent.keyboard("{Alt>}u{/Alt}")
  await expect.element(editor).toHaveTextContent("HELLO")
})
