import { RegistryProvider } from "@effect/atom-react"
import { Effect } from "effect"
import { useState } from "react"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { useAnnotations, useRemoveAnnotation, type ActionFailure } from "@ivin/plugin-api/ui"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { ServerClient, serverClientLayerAtom } from "../core/server-client.ts"
import { PluginsProvider } from "./plugin-host.tsx"

function Notes({ sessionId }: { sessionId: string }) {
  const notes = useAnnotations(sessionId, "note")
  const remove = useRemoveAnnotation()
  const [failure, setFailure] = useState<ActionFailure | undefined>()
  return (
    <div>
      {notes.map((note) => (
        <button key={note.id} type="button" onClick={() => void remove(note.id).then(setFailure)}>
          Remove {JSON.stringify(note.data)}
        </button>
      ))}
      <span>{notes.length} notes</span>
      {failure && <span>{failure.text}</span>}
    </div>
  )
}

const setup = async () => {
  const server = makeFakeServer()
  const call = <A, E>(rpc: (client: ServerClient["Service"]) => Effect.Effect<A, E>) =>
    Effect.runPromise(
      Effect.gen(function* () {
        return yield* rpc(yield* ServerClient)
      }).pipe(Effect.provide(server.layer)),
    )
  const session = await call((client) => client["session.create"]({ projectPath: "/p" }))
  // Another namespace than the caller's: the hook removes any.
  await call((client) =>
    client["annotation.add"]({
      target: { _tag: "session", sessionId: session.id },
      ns: "github",
      kind: "note",
      data: "first",
    }),
  )
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={[]}>
        <Notes sessionId={session.id} />
      </PluginsProvider>
    </RegistryProvider>,
  )
  return server
}

test("useRemoveAnnotation removes an annotation of any namespace through the server", async () => {
  await setup()
  await expect.element(page.getByText("1 notes")).toBeVisible()
  await page.getByRole("button", { name: 'Remove "first"' }).click()
  await expect.element(page.getByText("0 notes")).toBeVisible()
})

test("useRemoveAnnotation reports a failure the user can retry and keeps the annotation", async () => {
  const server = await setup()
  server.annotationRemovalFails = true
  await page.getByRole("button", { name: 'Remove "first"' }).click()
  await expect.element(page.getByText("It could not be removed. Try again.")).toBeVisible()
  await expect.element(page.getByText("1 notes")).toBeVisible()
})
