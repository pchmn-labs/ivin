import { ShellCommandNotOurs, ShellFoldersRefused } from "@ivin/contracts/cli"
import { expect, test } from "vitest"
import { installFailureMessage, pathHint } from "./shell-install-message.ts"

test("folders ivin could not write to are each named with the reason", () => {
  const error = new ShellFoldersRefused({
    folders: [
      { path: "/usr/local/bin", reason: "permissionDenied" },
      { path: "/Users/me/.local/bin", reason: "notAFolder" },
    ],
  })
  expect(installFailureMessage(error)).toBe(
    "Not installed. /usr/local/bin: ivin is not allowed to write there. /Users/me/.local/bin: it is a file, not a folder.",
  )
})

test("an ivin that is not ivin's link is named, with what to do", () => {
  expect(installFailureMessage(new ShellCommandNotOurs({ path: "/usr/local/bin/ivin" }))).toBe(
    "Not installed: /usr/local/bin/ivin already exists and is not ivin's. Remove it, then try again.",
  )
})

test("any other failure gets the action's own message", () => {
  expect(installFailureMessage(new Error("lost"))).toBe("ivin was not installed in your shell.")
})

test("a folder off the shell's PATH says to add it; on it, or unknown, says nothing", () => {
  const install = { folder: "/Users/me/.local/bin", path: "/Users/me/.local/bin/ivin" }
  expect(pathHint({ ...install, onPath: false })).toBe(
    "/Users/me/.local/bin is not on your shell's PATH: add it, then open a new terminal.",
  )
  expect(pathHint({ ...install, onPath: true })).toBeNull()
  expect(pathHint({ ...install, onPath: null })).toBeNull()
})
