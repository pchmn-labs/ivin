import { expect, test } from "vitest"
import {
  entryOwner,
  installedLink,
  isFolderOnPath,
  shellInstallPlan,
  type ShellFolder,
} from "./shell-install-plan.ts"

const command = "/Users/me/Library/Application Support/ivin/bin/ivin"
const system = "/usr/local/bin"
const local = "/Users/me/.local/bin"

const folder = (path: string, over: Partial<ShellFolder> = {}): ShellFolder => ({
  path,
  refusal: null,
  entry: { kind: "absent" },
  ...over,
})

test.each([
  ["nothing", { kind: "absent" }, "absent"],
  ["a link to ivin's command", { kind: "link", target: command }, "ours"],
  ["a link elsewhere", { kind: "link", target: "/opt/homebrew/bin/ivin" }, "foreign"],
  ["a file", { kind: "other" }, "foreign"],
] as const)("an ivin entry holding %s is %s", (_, entry, owner) => {
  expect(entryOwner(entry, command)).toBe(owner)
})

test("the link goes to /usr/local/bin when ivin can write there", () => {
  expect(shellInstallPlan([folder(system), folder(local)], command)).toEqual({
    kind: "link",
    folder: system,
  })
})

test("the link goes to ~/.local/bin when /usr/local/bin is not writable", () => {
  const plan = shellInstallPlan(
    [folder(system, { refusal: "permissionDenied" }), folder(local)],
    command,
  )
  expect(plan).toEqual({ kind: "link", folder: local })
})

test("installing again replaces ivin's own link where it already is", () => {
  const ours = { kind: "link", target: command } as const
  expect(shellInstallPlan([folder(system), folder(local, { entry: ours })], command)).toEqual({
    kind: "link",
    folder: local,
  })
})

test("an ivin that is not ivin's link is left alone and reported", () => {
  const plan = shellInstallPlan(
    [folder(system, { entry: { kind: "link", target: "/opt/ivin" } }), folder(local)],
    command,
  )
  expect(plan).toEqual({ kind: "notOurs", path: "/usr/local/bin/ivin" })
})

test("with no folder ivin can write to, each folder is named with its reason", () => {
  const plan = shellInstallPlan(
    [folder(system, { refusal: "permissionDenied" }), folder(local, { refusal: "notAFolder" })],
    command,
  )
  expect(plan).toEqual({
    kind: "refused",
    folders: [
      { path: system, reason: "permissionDenied" },
      { path: local, reason: "notAFolder" },
    ],
  })
})

test("the install shown is the first folder holding ivin's link, writable or not", () => {
  const ours = { kind: "link", target: command } as const
  expect(installedLink([folder(system), folder(local)], command)).toBeNull()
  expect(
    installedLink(
      [folder(system, { refusal: "permissionDenied", entry: ours }), folder(local)],
      command,
    ),
  ).toBe(system)
})

test.each([
  ["listed", ["/usr/bin", local], true],
  ["listed with a trailing slash", [`${local}/`], true],
  ["listed with a tilde", ["~/.local/bin"], true],
  ["missing", ["/usr/bin", "/bin"], false],
] as const)("a folder %s on the shell's PATH is on it: %s", (_, entries, on) => {
  expect(isFolderOnPath(local, entries, "/Users/me")).toBe(on)
})
