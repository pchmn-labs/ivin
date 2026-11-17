import { expect, test } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { launchPackagedApp, makeTempDir } from "./launch-app.ts"

interface ProcessEntry {
  readonly pid: number
  readonly ppid: number
  readonly command: string
}

const listProcesses = (): ReadonlyArray<ProcessEntry> =>
  execFileSync("ps", ["-A", "-o", "pid=,ppid=,command="], { encoding: "utf8" })
    .split("\n")
    .flatMap((line) => {
      const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line)
      return match ? [{ pid: Number(match[1]), ppid: Number(match[2]), command: match[3]! }] : []
    })

const descendantsOf = (root: number): ReadonlyArray<ProcessEntry> => {
  const all = listProcesses()
  const found: ProcessEntry[] = []
  const queue = [root]
  while (queue.length > 0) {
    const parent = queue.pop()!
    for (const proc of all) {
      if (proc.ppid === parent) {
        found.push(proc)
        queue.push(proc.pid)
      }
    }
  }
  return found
}

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

test("quitting the app leaves no server process running", async () => {
  const app = await launchPackagedApp(makeTempDir("user-data"))
  // app.process() throws once the app has exited.
  const appProcess = app.process()
  try {
    const appPid = appProcess.pid!
    const window = await app.firstWindow()
    await expect(window.getByTestId("server-version")).toHaveText("Server 0.0.0")

    const children = descendantsOf(appPid)
    const servers = children.filter((proc) => proc.command.includes("node.mojom.NodeService"))
    expect(servers.length).toBeGreaterThan(0)

    const exited = new Promise((resolve) => appProcess.once("exit", resolve))
    await app.evaluate(({ app }) => app.quit())
    await exited

    await expect.poll(() => children.filter((proc) => isAlive(proc.pid))).toEqual([])
  } finally {
    appProcess.kill()
  }
})
