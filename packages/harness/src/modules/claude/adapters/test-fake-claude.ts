import { chmodSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export const withFakeClaude = async <A>(
  body: string,
  use: (dir: string) => Promise<A>,
): Promise<A> => {
  const dir = mkdtempSync(join(tmpdir(), "ivin-fake-claude-"))
  const bin = join(dir, "claude")
  writeFileSync(bin, `#!/usr/bin/env node\n${body}`)
  chmodSync(bin, 0o755)
  const path = process.env["PATH"]
  process.env["PATH"] = `${dir}:${path}`
  try {
    return await use(dir)
  } finally {
    process.env["PATH"] = path
  }
}
