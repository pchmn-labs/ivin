import { chmodSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"

// CI has no `claude`: a test that reaches the installed one passes here and fails there.
if (process.env["IVIN_TEST_CLAUDE"] !== "1") {
  const dir = mkdtempSync(join(tmpdir(), "ivin-no-claude-"))
  const bin = join(dir, "claude")
  writeFileSync(
    bin,
    "#!/bin/sh\necho 'claude is hidden from unit tests: put a fake on the PATH' >&2\nexit 127\n",
  )
  chmodSync(bin, 0o755)
  process.env["PATH"] = `${dir}${delimiter}${process.env["PATH"] ?? ""}`
}
