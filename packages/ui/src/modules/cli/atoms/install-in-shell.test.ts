import { ShellFoldersRefused } from "@ivin/contracts/cli"
import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { installInShellAtom, shellInstallStateAtom } from "./install-in-shell.ts"

const setup = async () => {
  const { registry, server } = makeTestRegistry()
  registry.mount(shellInstallStateAtom)
  registry.mount(installInShellAtom)
  await vi.waitFor(() => expect(registry.get(shellInstallStateAtom).checking).toBe(false))
  return { registry, server }
}

test("an install shows where the link went", async () => {
  const { registry } = await setup()
  expect(registry.get(shellInstallStateAtom)).toMatchObject({ install: null, failure: null })

  registry.set(installInShellAtom, undefined)

  await vi.waitFor(() =>
    expect(registry.get(shellInstallStateAtom)).toMatchObject({
      install: { path: "/usr/local/bin/ivin" },
      installing: false,
      failure: null,
    }),
  )
})

test("a failed install shows its message until a retry succeeds", async () => {
  const { registry, server } = await setup()
  const installed = server.shell.nextInstall
  server.shell.nextInstall = new ShellFoldersRefused({
    folders: [{ path: "/usr/local/bin", reason: "readOnly" }],
  })

  registry.set(installInShellAtom, undefined)
  await vi.waitFor(() =>
    expect(registry.get(shellInstallStateAtom).failure).toBe(
      "Not installed. /usr/local/bin: its disk is read-only.",
    ),
  )

  server.shell.nextInstall = installed
  registry.set(installInShellAtom, undefined)
  await vi.waitFor(() =>
    expect(registry.get(shellInstallStateAtom)).toMatchObject({
      install: { path: "/usr/local/bin/ivin" },
      failure: null,
    }),
  )
})

test("a status that could not be read says so", async () => {
  const { registry, server } = makeTestRegistry()
  server.failNextCall("cli.getShellInstall")
  registry.mount(shellInstallStateAtom)
  await vi.waitFor(() => expect(registry.get(shellInstallStateAtom).checkFailed).toBe(true))
})
