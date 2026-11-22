import { Effect } from "effect"
import { execFileSync } from "node:child_process"
import {
  chmodSync,
  mkdtempSync,
  readlinkSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { inspectFolder, linkCommand, readLoginShellPath } from "./fs-shell-command.ts"

const tempFolder = () => mkdtempSync(join(tmpdir(), "ivin-shell-"))

const commandScript = () => {
  const command = join(tempFolder(), "ivin")
  writeFileSync(command, '#!/bin/sh\necho "ran $*"\n')
  chmodSync(command, 0o755)
  return command
}

test("a link made in a missing folder creates it, and the linked ivin runs", () => {
  const command = commandScript()
  const bin = join(tempFolder(), ".local", "bin")
  expect(inspectFolder(bin)).toEqual({ path: bin, refusal: null, entry: { kind: "absent" } })

  linkCommand(bin, command)

  expect(inspectFolder(bin).entry).toEqual({ kind: "link", target: command })
  expect(execFileSync(join(bin, "ivin"), ["doctor"], { encoding: "utf8" })).toBe("ran doctor\n")
})

test("linking again replaces ivin's link and leaves nothing else in the folder", () => {
  const bin = tempFolder()
  linkCommand(bin, "/old/ivin")
  linkCommand(bin, "/new/ivin")

  expect(readlinkSync(join(bin, "ivin"))).toBe("/new/ivin")
  expect(readdirSync(bin)).toEqual(["ivin"])
})

test("a file named ivin is an entry of another kind", () => {
  const bin = tempFolder()
  writeFileSync(join(bin, "ivin"), "#!/bin/sh\n")
  expect(inspectFolder(bin).entry).toEqual({ kind: "other" })
})

test("a folder ivin cannot write to, or a file where the folder should be, is refused", () => {
  const locked = tempFolder()
  chmodSync(locked, 0o500)
  const file = join(tempFolder(), "bin")
  writeFileSync(file, "")
  try {
    expect(inspectFolder(locked).refusal).toBe("permissionDenied")
    expect(inspectFolder(join(locked, "missing", "bin")).refusal).toBe("permissionDenied")
    expect(inspectFolder(file).refusal).toBe("notAFolder")
  } finally {
    chmodSync(locked, 0o700)
  }
})

test("a link to the folder works like the folder", () => {
  const real = tempFolder()
  const linked = join(tempFolder(), "bin")
  symlinkSync(real, linked)
  expect(inspectFolder(linked).refusal).toBeNull()
})

const fakeShell = (body: string) => {
  const shell = join(tempFolder(), "shell")
  writeFileSync(shell, `#!/bin/sh\n${body}\neval "$2"\n`)
  chmodSync(shell, 0o755)
  return shell
}

test("the login shell's PATH is read from what it prints, past its own noise", async () => {
  const shell = fakeShell('echo "Welcome"; PATH="/opt/bin:$HOME/.local/bin"')
  const entries = await Effect.runPromise(readLoginShellPath(shell, 5_000))
  expect(entries).toEqual(["/opt/bin", `${process.env["HOME"]}/.local/bin`])
})

test("a login shell that fails or hangs gives no PATH", async () => {
  expect(await Effect.runPromise(readLoginShellPath(fakeShell("exit 1"), 5_000))).toBeNull()
  expect(await Effect.runPromise(readLoginShellPath(fakeShell("sleep 5"), 100))).toBeNull()
})
