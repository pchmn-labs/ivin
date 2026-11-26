import { CliRpcs, type FolderRefusal } from "@ivin/contracts/cli"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { expect, test } from "vitest"
import type { ShellFolder } from "../modules/cli/rules/shell-install-plan.ts"
import { layerShellCommandOf } from "../modules/cli/usecases/shell-command.ts"
import { serverLayer } from "./test-server.ts"

const command = "/Users/me/Library/Application Support/ivin/bin/ivin"
const system = "/usr/local/bin"
const local = "/Users/me/.local/bin"

const makeClient = () => RpcTest.makeClient(CliRpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withShell = <A, E>(
  shell: {
    folders: ReadonlyArray<ShellFolder>
    shellPath?: ReadonlyArray<string> | null
    linkRefusal?: FolderRefusal
  },
  use: (client: Client) => Effect.Effect<A, E>,
) =>
  makeClient().pipe(
    Effect.flatMap(use),
    Effect.provide(
      serverLayer().pipe(
        Layer.provide(layerShellCommandOf({ command, shellPath: ["/usr/bin", system], ...shell })),
      ),
    ),
    Effect.scoped,
    Effect.runPromise,
  )

const empty = (path: string, refusal: FolderRefusal | null = null): ShellFolder => ({
  path,
  refusal,
  entry: { kind: "absent" },
})

test("cli.installInShell links ivin into /usr/local/bin, and cli.getShellInstall then reports it", async () => {
  const result = await withShell({ folders: [empty(system), empty(local)] }, (client) =>
    Effect.gen(function* () {
      const before = yield* client["cli.getShellInstall"]()
      const installed = yield* client["cli.installInShell"]()
      return { before, installed, after: yield* client["cli.getShellInstall"]() }
    }),
  )

  const install = { folder: system, path: "/usr/local/bin/ivin", onPath: true }
  expect(result).toEqual({ before: null, installed: install, after: install })
})

test("with /usr/local/bin not writable, the link goes to ~/.local/bin, reported off the PATH", async () => {
  const installed = await withShell(
    { folders: [empty(system, "permissionDenied"), empty(local)] },
    (client) => client["cli.installInShell"](),
  )

  expect(installed).toEqual({ folder: local, path: `${local}/ivin`, onPath: false })
})

test("a login shell whose PATH could not be read leaves the PATH question open", async () => {
  const installed = await withShell({ folders: [empty(system)], shellPath: null }, (client) =>
    client["cli.installInShell"](),
  )

  expect(installed.onPath).toBeNull()
})

test("with no folder writable, the install fails naming each folder and its reason", async () => {
  const error = await withShell(
    { folders: [empty(system, "permissionDenied"), empty(local, "readOnly")] },
    (client) => Effect.flip(client["cli.installInShell"]()),
  )

  expect(error).toMatchObject({
    _tag: "ShellFoldersRefused",
    folders: [
      { path: system, reason: "permissionDenied" },
      { path: local, reason: "readOnly" },
    ],
  })
})

test("a link that fails in a folder that looked writable names that folder", async () => {
  const error = await withShell(
    { folders: [empty(system), empty(local)], linkRefusal: "unknown" },
    (client) => Effect.flip(client["cli.installInShell"]()),
  )

  expect(error).toMatchObject({ folders: [{ path: system, reason: "unknown" }] })
})

test("an ivin that is not ivin's link is reported and left in place", async () => {
  const result = await withShell(
    { folders: [{ ...empty(system), entry: { kind: "other" } }, empty(local)] },
    (client) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(client["cli.installInShell"]())
        return { error, after: yield* client["cli.getShellInstall"]() }
      }),
  )

  expect(result.error).toMatchObject({ _tag: "ShellCommandNotOurs", path: "/usr/local/bin/ivin" })
  expect(result.after).toBeNull()
})
