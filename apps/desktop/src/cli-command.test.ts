import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { writeCliCommand } from "./cli-command.ts"

test("the ivin command runs the CLI entry with Electron as Node, passing its arguments through", () => {
  const folder = mkdtempSync(join(tmpdir(), "ivin it's-"))
  const entry = join(folder, "entry.js")
  writeFileSync(
    entry,
    "console.log(JSON.stringify({ args: process.argv.slice(2), asNode: process.env.ELECTRON_RUN_AS_NODE }))",
  )

  const command = writeCliCommand(join(folder, "bin"), process.execPath, entry)
  const output = execFileSync(command, ["doctor", "--json", "a b"], { encoding: "utf8" })

  expect(JSON.parse(output)).toEqual({ args: ["doctor", "--json", "a b"], asNode: "1" })
})
