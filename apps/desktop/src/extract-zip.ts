import { execFile } from "node:child_process"
import { mkdir } from "node:fs/promises"
import { promisify } from "node:util"

const run = promisify(execFile)

// ditto restores the symlinks and permissions Electron's frameworks need, as it wrote them.
export const extractZip = async (zip: string, folder: string): Promise<void> => {
  await mkdir(folder, { recursive: true })
  if (process.platform === "darwin") await run("ditto", ["-x", "-k", zip, folder])
  else await run("unzip", ["-q", zip, "-d", folder])
}
