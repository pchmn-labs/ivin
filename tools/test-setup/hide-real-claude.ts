import { existsSync } from "node:fs"
import { delimiter, join } from "node:path"

// CI has no `claude`: a test that reaches the installed one passes here and fails there.
if (process.env["IVIN_TEST_CLAUDE"] !== "1") {
  process.env["PATH"] = (process.env["PATH"] ?? "")
    .split(delimiter)
    .filter((dir) => !existsSync(join(dir, "claude")))
    .join(delimiter)
}
