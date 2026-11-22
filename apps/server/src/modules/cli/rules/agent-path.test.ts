import { expect, test } from "vitest"
import { agentPath } from "./agent-path.ts"

const cli = "/Users/me/Library/Application Support/ivin/bin"
const dock = `${cli}:/usr/bin:/bin:/usr/sbin:/sbin`

test("the login shell's folders come after the ivin command's folder and before the app's own", () => {
  expect(agentPath(dock, ["/Users/me/.local/bin", "/opt/homebrew/bin", "/usr/bin"], cli)).toBe(
    `${cli}:/Users/me/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
  )
})

test("the app keeps its own PATH when the login shell's could not be read", () => {
  expect(agentPath(dock, null, cli)).toBe(dock)
})

test("without an ivin command, the login shell's folders come first", () => {
  expect(agentPath("/usr/bin:/bin", ["/Users/me/.local/bin", "", "/bin"], null)).toBe(
    "/Users/me/.local/bin:/bin:/usr/bin",
  )
})
