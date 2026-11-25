import { expect, test, type Page } from "@playwright/test"
import { execFileSync } from "node:child_process"
import {
  fakeClaudeCommand,
  launchPackagedApp,
  makeFakeClaudeBin,
  makeTempDir,
} from "./launch-app.ts"
import { descendantsOf, isAlive } from "./processes.ts"
import { sendMessage, startSession } from "./session-helpers.ts"

const WARM_UP_ROUNDS = 2
const MEASURED_ROUNDS = 3
// A reload drops the renderer's JS heap, so the heap is read over rounds that do not reload.
const HEAP_MEASURED_ROUNDS = 3
// On main the heap grows about 100 KB per closed session, which stays in the Inactive sessions list.
const MAX_OPEN_FILES_GROWTH = 10
const MAX_HEAP_GROWTH_BYTES = 6 * 1024 * 1024

// A process that exited since the listing has no files left to count.
const openFiles = (pid: number): number => {
  if (!isAlive(pid)) return 0
  return execFileSync("lsof", ["-n", "-P", "-p", String(pid)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
    .split("\n")
    .slice(1)
    .filter(Boolean).length
}

// ps and lsof run as the app's children while they measure it.
const appProcesses = (appPid: number) => [
  appPid,
  ...descendantsOf(appPid)
    .filter((proc) => !/^(ps|lsof)\b/.test(proc.command))
    .map((proc) => proc.pid),
]

const totalOpenFiles = (appPid: number) =>
  appProcesses(appPid).reduce((sum, pid) => sum + openFiles(pid), 0)

const heapUsed = async (window: Page): Promise<number> => {
  const cdp = await window.context().newCDPSession(window)
  try {
    await cdp.send("HeapProfiler.collectGarbage")
    return (await cdp.send("Runtime.getHeapUsage")).usedSize
  } finally {
    await cdp.detach()
  }
}

test.setTimeout(600_000)

// Flaky on CI: #361.
test.fixme("opening and closing sessions, switching tabs and reloading the window leaves no agent process, open file or heap behind", async () => {
  const app = await launchPackagedApp(makeTempDir("user-data"), {
    fakeClaudeBin: makeFakeClaudeBin(),
  })
  const appPid = app.process().pid!
  try {
    const window = await startSession(app)
    const tabs = window.getByRole("tablist", { name: "Open sessions" }).getByRole("tab")
    const agents = () =>
      descendantsOf(appPid).filter((proc) => proc.command.includes(fakeClaudeCommand)).length

    // The session that startSession opened stays, so a tab switch has somewhere to go.
    await sendMessage(window, "Stays open")
    await expect(
      window.getByTestId("turn-step").filter({ hasText: "echo: Stays open" }),
    ).toHaveCount(1)
    await expect.poll(agents).toBe(1)

    const round = async (n: number, reload: boolean) => {
      const title = `Round ${n}`
      const tab = window.getByTestId("tab").filter({ hasText: title })
      let last = Date.now()
      const lap = (what: string) => {
        console.log(`TIMING round ${n} ${what}: ${Date.now() - last} ms`)
        last = Date.now()
      }
      await window.getByRole("button", { name: "New session", exact: true }).last().click()
      lap("click new session")
      await expect(tabs).toHaveCount(2)
      lap("second tab")
      await sendMessage(window, title)
      await expect(
        window.getByTestId("turn-step").filter({ hasText: `echo: ${title}` }),
      ).toHaveCount(1)
      lap("echo")
      await tabs.first().click()
      await expect(tabs.first()).toHaveAttribute("aria-selected", "true")
      await tab.click()
      await expect(tabs.last()).toHaveAttribute("aria-selected", "true")

      lap("switch tabs")
      await tab.hover()
      await window.getByRole("button", { name: `Close ${title}`, includeHidden: true }).click()
      await window.getByRole("dialog").getByRole("button", { name: "Stop and close" }).click()
      lap("close dialog")
      await expect(tabs).toHaveCount(1)
      lap("tab gone")
      await expect.poll(agents).toBe(1)
      lap("agent gone")

      if (reload) {
        await window.reload()
        await expect(tabs).toHaveCount(1)
        lap("reload")
      }
    }

    const started = Date.now()
    const elapsed = (what: string) => console.log(`${what}: ${(Date.now() - started) / 1000} s`)
    for (let n = 0; n < WARM_UP_ROUNDS; n++) await round(n, true)
    const filesBefore = totalOpenFiles(appPid)
    for (let n = 0; n < MEASURED_ROUNDS; n++) await round(n, true)
    const filesAfter = totalOpenFiles(appPid)
    elapsed("rounds with a reload")

    for (let n = 0; n < WARM_UP_ROUNDS; n++) await round(n, false)
    const heapBefore = await heapUsed(window)
    for (let n = 0; n < HEAP_MEASURED_ROUNDS; n++) await round(n, false)
    const heapAfter = await heapUsed(window)
    elapsed("rounds without a reload")

    expect(filesAfter - filesBefore).toBeLessThanOrEqual(MAX_OPEN_FILES_GROWTH)
    expect(heapAfter - heapBefore).toBeLessThan(MAX_HEAP_GROWTH_BYTES)
  } finally {
    await app.close()
  }
})
