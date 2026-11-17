import { execFileSync } from "node:child_process"

export interface ProcessEntry {
  readonly pid: number
  readonly ppid: number
  readonly command: string
}

export const listProcesses = (): ReadonlyArray<ProcessEntry> =>
  execFileSync("ps", ["-A", "-o", "pid=,ppid=,command="], { encoding: "utf8" })
    .split("\n")
    .flatMap((line) => {
      const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line)
      return match ? [{ pid: Number(match[1]), ppid: Number(match[2]), command: match[3]! }] : []
    })

export const descendantsOf = (root: number): ReadonlyArray<ProcessEntry> => {
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

export const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
