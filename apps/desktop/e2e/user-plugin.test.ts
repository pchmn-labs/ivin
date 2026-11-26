import { expect, test } from "@playwright/test"
import { execFile } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { launchPackagedApp, makeTempDir } from "./launch-app.ts"
import { startSession } from "./session-helpers.ts"

const writePlugin = (userDataDir: string, folder: string, files: Record<string, string>) => {
  for (const [path, text] of Object.entries(files)) {
    const file = join(userDataDir, ".ivin/plugins", folder, path)
    mkdirSync(join(file, ".."), { recursive: true })
    writeFileSync(file, text)
  }
}

test("a plugin in ~/.ivin/plugins is compiled and shows in the window, beside one that fails", async () => {
  const userDataDir = makeTempDir("user-data")
  writePlugin(userDataDir, "hello", {
    "package.json": JSON.stringify({ name: "hello", ivin: { id: "hello", ui: "src/ui.tsx" } }),
    "src/ui.tsx": `import { useState } from "react"
import { defineUi } from "@ivin/plugin-api/ui"

function Hello() {
  const [count] = useState(41)
  return <span>hello from a plugin {count + 1}</span>
}

export const activate = defineUi((ctx) => ctx.slots.add("sidebar.bottom", Hello))
`,
  })
  writePlugin(userDataDir, "broken", {
    "package.json": JSON.stringify({ ivin: { id: "broken", ui: "src/ui.tsx" } }),
    "src/ui.tsx": "export const activate = (",
  })

  const app = await launchPackagedApp(userDataDir)
  try {
    const window = await startSession(app)
    await expect(window.getByText("hello from a plugin 42")).toBeVisible()
  } finally {
    await app.close()
  }
})

// /usr/bin and /bin hold neither Node nor pnpm on the CI machines.
const BARE_PATH = "/usr/bin:/bin"

const readLog = async (userDataDir: string, id: string) =>
  readFile(join(userDataDir, ".ivin/logs/plugins", `${id}.log`), "utf8").catch(() => "no log")

const runIvin = (userDataDir: string, args: string[]) =>
  new Promise<{ code: number; output: string }>((resolve) => {
    execFile(
      join(userDataDir, "bin", "ivin"),
      args,
      { env: { PATH: BARE_PATH, IVIN_SOCKET: join(userDataDir, ".ivin/run/ivin.sock") } },
      (error, stdout, stderr) =>
        resolve({ code: error ? Number(error.code) : 0, output: stdout + stderr }),
    )
  })

test("with no Node and no pnpm on the PATH, ivin plugin lock and the next load install a plugin's dependency", async () => {
  const userDataDir = makeTempDir("user-data")
  const dependency = join(makeTempDir("package"), "shouter")
  mkdirSync(dependency)
  writeFileSync(
    join(dependency, "package.json"),
    JSON.stringify({ name: "shouter", version: "1.0.0", main: "index.js" }),
  )
  writeFileSync(
    join(dependency, "index.js"),
    'const { createElement } = require("react")\nexports.Shout = ({ text }) => createElement("strong", null, text.toUpperCase())\n',
  )
  writePlugin(userDataDir, "shout", {
    "package.json": JSON.stringify({
      ivin: { id: "shout", ui: "src/ui.tsx" },
      dependencies: { shouter: `file:${dependency}` },
    }),
    "src/ui.tsx": `import { Shout } from "shouter"
import { defineUi } from "@ivin/plugin-api/ui"

export const activate = defineUi((ctx) =>
  ctx.slots.add("sidebar.bottom", () => <Shout text="hello from a dependency" />),
)
`,
  })

  const app = await launchPackagedApp(userDataDir, { path: BARE_PATH })
  try {
    const window = await startSession(app)
    const lock = await runIvin(userDataDir, ["plugin", "lock", "shout"])
    expect(lock, lock.output).toMatchObject({ code: 0 })

    await window.reload()

    await expect(window.getByText("HELLO FROM A DEPENDENCY"))
      .toBeVisible()
      .catch(async (error: Error) => {
        // Why the plugin did not load, read once the wait is over.
        throw new Error(`${error.message}\n\nPlugin log: ${await readLog(userDataDir, "shout")}`)
      })
  } finally {
    await app.close()
  }
})

test("the packaged app runs a plugin's server half in the plugin host, and restarts the host without a half that loops", async () => {
  const userDataDir = makeTempDir("user-data")
  writePlugin(userDataDir, "talker", {
    "package.json": JSON.stringify({ ivin: { id: "talker", server: "src/server.ts" } }),
    "src/server.ts": `import { defineServer } from "@ivin/plugin-api/server"
export const activate = defineServer(() => { console.log("talker is active") })
`,
  })
  writePlugin(userDataDir, "looper", {
    "package.json": JSON.stringify({ ivin: { id: "looper", server: "src/server.ts" } }),
    "src/server.ts": "export const activate = () => { while (true) {} }\n",
  })

  const app = await launchPackagedApp(userDataDir)
  try {
    const window = await startSession(app)
    await expect
      .poll(async () => (await runIvin(userDataDir, ["plugin", "list"])).output, {
        timeout: 60_000,
      })
      .toMatch(/looper\s+ui: none\s+server: disabled\n.*talker\s+ui: none\s+server: active/s)
    expect((await runIvin(userDataDir, ["plugin", "logs", "talker"])).output).toContain(
      "talker is active",
    )
    expect((await runIvin(userDataDir, ["plugin", "logs", "looper"])).output).toContain(
      "Disabled for blocking",
    )
    // The window and its sessions kept running.
    await expect(window.getByRole("textbox", { name: "Message" })).toBeVisible()
  } finally {
    await app.close()
  }
})

test("editing a plugin's UI half updates the window without a reload, and ivin plugin new and check work from the packaged app", async () => {
  const userDataDir = makeTempDir("user-data")
  const app = await launchPackagedApp(userDataDir)
  try {
    const window = await startSession(app)
    const created = await runIvin(userDataDir, ["plugin", "new", "demo"])
    expect(created).toMatchObject({ code: 0 })
    await expect(window.getByText("The demo plugin is running.")).toBeVisible()
    const checked = await runIvin(userDataDir, ["plugin", "check", "demo"])
    expect(checked.output).toContain("has no type error")
    expect(checked).toMatchObject({ code: 0 })

    const draft = window.getByRole("textbox", { name: "Message" })
    await draft.fill("a draft that must survive")
    writeFileSync(
      join(userDataDir, ".ivin/plugins/demo/src/ui.tsx"),
      (await readFile(join(userDataDir, ".ivin/plugins/demo/src/ui.tsx"), "utf8")).replace(
        "is running.",
        "was edited.",
      ),
    )
    await expect(window.getByText("The demo plugin was edited.")).toBeVisible()
    await expect(draft).toHaveValue("a draft that must survive")
  } finally {
    await app.close()
  }
})
