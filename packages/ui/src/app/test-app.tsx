import { RegistryProvider } from "@effect/atom-react"
import type { FolderEntry } from "@ivin/contracts/file"
import type { SubView } from "@ivin/contracts/tab"
import { DateTime } from "effect"
import { render } from "vitest-browser-react"
import { makeFakeServer, type FakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { builtinPlugins } from "../core/test-builtin-plugins.ts"
import { App } from "./app.tsx"

// A trailing `/` makes a folder, a leading `!` an entry git ignores.
export const folder = (...names: string[]): ReadonlyArray<FolderEntry> =>
  names.map((raw) => {
    const ignored = raw.startsWith("!")
    const name = ignored ? raw.slice(1) : raw
    return name.endsWith("/")
      ? { name: name.slice(0, -1), kind: "folder", ignored }
      : { name, kind: "file", ignored }
  })

export const fileView = (path: string): SubView => ({ view: "files/file", params: { path } })

export const seedSubViews = (
  server: FakeServer,
  subViews: ReadonlyArray<SubView>,
  {
    selected = subViews.at(-1),
    fullWidth = false,
    sessionTabSelected = false,
  }: { selected?: SubView; fullWidth?: boolean; sessionTabSelected?: boolean } = {},
) =>
  server.subViews.set("s1", {
    sessionId: "s1",
    subViews,
    selected: selected ?? null,
    fullWidth,
    sessionTabSelected,
  })

export const mountApp = (
  server: FakeServer,
  { height, container }: { height?: number; container?: HTMLElement } = {},
) =>
  render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      {height === undefined ? (
        <App plugins={builtinPlugins} />
      ) : (
        <div ref={(element) => element?.style.setProperty("height", `${height}px`)}>
          <App plugins={builtinPlugins} />
        </div>
      )}
    </RegistryProvider>,
    container && { container },
  )

export const shopProject = "/dev/shop"
export const shopWorktree = "/dev/shop/.worktrees/fix-cart"

export const makeShopServer = () => {
  const server = makeFakeServer({
    project: { path: shopProject, name: "shop", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  for (const [id, title, workingFolder] of [
    ["s1", "Checkout flow", shopProject],
    ["s2", "Fix the cart", shopWorktree],
  ] as const) {
    server.sessions.set(
      id,
      makeTestSession({
        id,
        title,
        projectPath: shopProject,
        workingFolder,
        inWorktree: workingFolder !== shopProject,
      }),
    )
  }
  return server
}
