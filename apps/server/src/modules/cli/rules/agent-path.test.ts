import { expect, test } from "vitest"
import { agentPath } from "./agent-path.ts"

const cli = "/Users/me/Library/Application Support/ivin/bin"
const dock = `${cli}:/usr/bin:/bin:/usr/sbin:/sbin`
const shell = [
  "/Users/me/.local/bin",
  "/opt/homebrew/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
]

test("the login shell's folders come after the ivin command's folder and before the app's own", () => {
  expect(agentPath(dock, shell)).toBe(
    `${cli}:/Users/me/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
  )
})

test("folders put before the login shell's keep their place", () => {
  expect(agentPath(`/tmp/fake-claude:${cli}:/Users/me/.local/bin:/usr/bin`, shell)).toBe(
    `/tmp/fake-claude:${cli}:/Users/me/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
  )
})

test("the app keeps its own PATH when the login shell's could not be read", () => {
  expect(agentPath(dock, null)).toBe(dock)
})

test("empty folders are dropped", () => {
  expect(agentPath("/usr/bin::/bin", ["", "/Users/me/.local/bin", "/bin"])).toBe(
    "/usr/bin:/Users/me/.local/bin:/bin",
  )
})
