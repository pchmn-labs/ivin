import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  MessageChannelMain,
  net,
  protocol,
  shell,
  utilityProcess,
  type UtilityProcess,
} from "electron"
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { delimiter, dirname, isAbsolute, join } from "node:path"
import { pathToFileURL } from "node:url"
import { appMenuTemplate } from "./app-menu.ts"
import {
  CHECK_FOR_UPDATES,
  DEV_BUILD_ARGUMENT,
  GET_SERVER_STATE,
  GET_STARTUP_NOTICE,
  GET_UPDATE_STATE,
  LAUNCH_SETTLED,
  OPEN_SETTINGS_FILE,
  PICK_FOLDER,
  PLUGIN_ACTIVITY,
  RESTART_SERVER,
  RESTART_TO_UPDATE,
  RPC_PORT_REPLY,
  RPC_PORT_REQUEST,
  SERVER_STATE,
  SHOW_IN_FOLDER,
  UPDATE_STATE,
  WINDOW_LAYOUT,
} from "./channels.ts"
import { writeCliCommand } from "./cli-command.ts"
import {
  launchModeFrom,
  parseLaunchRecord,
  SAFE_ARGUMENT,
  type LaunchMode,
  type LaunchRecord,
} from "./launch-mode.ts"
import { linkTarget } from "./link-target.ts"
import { IMAGE_SCHEME, imageFile } from "./image-protocol.ts"
import { PLUGIN_SCHEME, pluginFile } from "./plugin-protocol.ts"
import { PLUGIN_BUNDLE_SCHEME, pluginBundleFile } from "./plugin-bundle-protocol.ts"
import { mergeDisabledPlugins, pluginsToBlame, type PluginActivity } from "./plugin-blame.ts"
import { createRestartPolicy } from "./restart-policy.ts"
import { automaticCheckFrom, betaFrom } from "./update-settings.ts"
import { createUpdater, startSwap } from "./updater.ts"

// A dev build keeps its own data, so it never shares a database with the installed app.
const devBuild = !app.isPackaged
if (devBuild && !app.commandLine.hasSwitch("user-data-dir")) {
  app.setPath("userData", join(app.getPath("appData"), "ivin-dev"))
}
if (devBuild) app.setName("ivin Dev")
// The lock is per userData folder, so it comes after the folder is set.
const isFirstInstance = app.requestSingleInstanceLock()
if (!isFirstInstance) app.quit()

const devUrl = process.env["IVIN_DEV_URL"]
const openInBackground = process.env["IVIN_BACKGROUND"] === "1"
// Set before ready: after it, macOS has already activated the app and shown its Dock icon.
if (openInBackground && process.platform === "darwin") app.setActivationPolicy("accessory")

// The server bundle sits at the same place inside the app (asar included) as in the repo.
const serverEntry = app.isPackaged
  ? join(app.getAppPath(), "server/main.js")
  : join(import.meta.dirname, "../../server/dist/main.js")
const pluginHostEntry = app.isPackaged
  ? join(process.resourcesPath, "plugin-host/plugin-host.js")
  : join(import.meta.dirname, "../../server/dist/plugin-host.js")
const cliEntry = app.isPackaged
  ? join(process.resourcesPath, "cli/ivin.js")
  : join(import.meta.dirname, "../../cli/dist/ivin.js")
const builtinPluginsFolder = app.isPackaged
  ? join(process.resourcesPath, "builtin-plugins")
  : join(import.meta.dirname, "../../server/dist/builtin-plugins")
const pnpmFolder = app.isPackaged
  ? join(process.resourcesPath, "pnpm")
  : join(import.meta.dirname, "../../server/dist/pnpm")
const pluginToolsFolder = app.isPackaged
  ? join(process.resourcesPath, "plugin-tools")
  : join(import.meta.dirname, "../../server/dist/plugin-tools")
const skillsFolder = app.isPackaged
  ? join(process.resourcesPath, "skills")
  : join(import.meta.dirname, "../../server/skills")
const rendererEntry = app.isPackaged
  ? join(app.getAppPath(), "renderer/index.html")
  : join(import.meta.dirname, "../../../packages/ui/dist/index.html")
const pluginsFolder = app.isPackaged
  ? join(process.resourcesPath, "plugins")
  : join(import.meta.dirname, "../../../plugins")
const appPage = devUrl ?? pathToFileURL(rendererEntry).toString()

process.on("uncaughtException", (error) => {
  console.error(error)
  process.exit(1)
})

type ServerState =
  | { readonly kind: "running" }
  | { readonly kind: "restarting" }
  | { readonly kind: "gave-up"; readonly logPath: string }

let server: UtilityProcess | null = null
let serverState: ServerState = { kind: "running" }
let startServer: (options?: { readonly manual: boolean }) => void = () => {}

// Registered before ready: the window loads sent images and plugins' files straight from disk.
protocol.registerSchemesAsPrivileged([
  // The composer reads unread messages' images with fetch, from the window's own origin.
  {
    scheme: IMAGE_SCHEME,
    privileges: { standard: true, secure: true, corsEnabled: true, supportFetchAPI: true },
  },
  { scheme: PLUGIN_SCHEME, privileges: { standard: true, secure: true } },
  // A module script is fetched with CORS, from the window's own origin.
  {
    scheme: PLUGIN_BUNDLE_SCHEME,
    privileges: { standard: true, secure: true, corsEnabled: true, supportFetchAPI: true },
  },
])

const openOutside = (url: string) => {
  if (linkTarget(url, appPage) === "browser") void shell.openExternal(url)
}

type StartupNotice =
  | { readonly _tag: "safeForced" }
  | { readonly _tag: "safeAfterCrash" }
  | { readonly _tag: "reloadedWithout"; readonly plugins: readonly string[] }

let launchMode: LaunchMode = { kind: "normal" }
let launchRecord: LaunchRecord = { startedAt: 0, settled: false, quit: false }
// Safe mode lasts the whole launch, so its notice shows on every load; a reload's shows once.
let nextLoadNotice: StartupNotice | null = null
let currentNotice: StartupNotice | null = null
let activity: PluginActivity[] = []
const unresponsiveReloads = createRestartPolicy()

const launchFile = () => join(ivinHome, "launch.json")
const disabledPluginsFile = () => join(ivinHome, "disabled-plugins.json")

const readFileOrNull = (file: string) => {
  try {
    return readFileSync(file, "utf8")
  } catch {
    return null
  }
}

const writeAtomically = (file: string, text: string) => {
  try {
    mkdirSync(ivinHome, { recursive: true, mode: 0o700 })
    const temporary = `${file}.${process.pid}.tmp`
    writeFileSync(temporary, text)
    renameSync(temporary, file)
  } catch (error) {
    console.error(`could not write ${file}`, error)
  }
}

const saveLaunchRecord = (patch: Partial<LaunchRecord>) => {
  launchRecord = { ...launchRecord, ...patch }
  writeAtomically(launchFile(), `${JSON.stringify(launchRecord)}\n`)
}

const safeNotice = (mode: LaunchMode): StartupNotice | null =>
  mode.kind === "normal"
    ? null
    : mode.reason === "forced"
      ? { _tag: "safeForced" }
      : { _tag: "safeAfterCrash" }

const reloadWithout = (window: BrowserWindow) => {
  if (launchMode.kind === "safe") return
  const blamed = pluginsToBlame(activity, Date.now())
  if (unresponsiveReloads(Date.now(), true) === "give-up") return
  if (blamed.length > 0) {
    writeAtomically(
      disabledPluginsFile(),
      `${JSON.stringify(mergeDisabledPlugins(readFileOrNull(disabledPluginsFile()), blamed))}\n`,
    )
    nextLoadNotice = { _tag: "reloadedWithout", plugins: blamed }
  }
  window.webContents.reload()
}

// Centred on the top row of the window's layout, 15pt in from the sidebar's left edge.
const TRAFFIC_LIGHTS = {
  panels: { x: 21, y: 19 },
  plane: { x: 15, y: 13 },
} as const

const createWindow = async () => {
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    show: false,
    ...(process.platform === "darwin" && {
      titleBarStyle: "hiddenInset" as const,
      trafficLightPosition: TRAFFIC_LIGHTS.panels,
    }),
    webPreferences: {
      preload: join(import.meta.dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: devBuild ? [DEV_BUILD_ARGUMENT] : [],
      // A window never shown must still render for e2e and `shot`.
      backgroundThrottling: !openInBackground,
    },
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url)
    return { action: "deny" }
  })
  window.webContents.on("did-start-navigation", (details) => {
    if (!details.isMainFrame || details.isSameDocument) return
    currentNotice = nextLoadNotice ?? safeNotice(launchMode)
    nextLoadNotice = null
    activity = []
  })
  window.on("unresponsive", () => reloadWithout(window))
  window.webContents.on("will-navigate", (event) => {
    if (linkTarget(event.url, appPage) === "app") return
    event.preventDefault()
    openOutside(event.url)
  })
  // Any show call, even showInactive, raises the window above other apps.
  if (!openInBackground) window.once("ready-to-show", () => window.show())
  if (devUrl) {
    // The Vite dev server may start after the window opens.
    window.webContents.on("did-fail-load", () => setTimeout(() => void window.loadURL(devUrl), 500))
    await window.loadURL(devUrl).catch(() => undefined)
  } else {
    await window.loadFile(rendererEntry)
  }
}

// One channel per request: the renderer asks again after each reload.
ipcMain.on(RPC_PORT_REQUEST, (event, id: unknown) => {
  // The window asks again once the restarted server is back.
  if (!server) return
  const { port1, port2 } = new MessageChannelMain()
  server.postMessage({}, [port1])
  event.sender.postMessage(RPC_PORT_REPLY, id, [port2])
})

ipcMain.handle(GET_STARTUP_NOTICE, () => currentNotice)
ipcMain.on(PLUGIN_ACTIVITY, (_event, value: { id?: unknown; phase?: unknown }) => {
  if (typeof value?.id !== "string") return
  if (value.phase !== "activating" && value.phase !== "activated") return
  activity.push({ at: Date.now(), id: value.id, phase: value.phase })
  if (activity.length > 500) activity.splice(0, activity.length - 500)
})
ipcMain.on(WINDOW_LAYOUT, (event, layout: unknown) => {
  if (process.platform !== "darwin" || (layout !== "panels" && layout !== "plane")) return
  BrowserWindow.fromWebContents(event.sender)?.setWindowButtonPosition(TRAFFIC_LIGHTS[layout])
})
ipcMain.on(LAUNCH_SETTLED, () => {
  if (!launchRecord.settled) saveLaunchRecord({ settled: true })
})

ipcMain.handle(PICK_FOLDER, async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  // Only macOS picks a folder or a file in one dialog; elsewhere it would lose the folders.
  const options =
    process.platform === "darwin"
      ? {
          properties: ["openDirectory" as const, "openFile" as const],
          filters: [{ name: "Workspace", extensions: ["code-workspace"] }],
        }
      : { properties: ["openDirectory" as const] }
  const result = await (window
    ? dialog.showOpenDialog(window, options)
    : dialog.showOpenDialog(options))
  return result.canceled ? null : (result.filePaths[0] ?? null)
})

app.on("window-all-closed", () => app.quit())
const SERVER_STOP_TIMEOUT_MS = 5_000
let serverStopped = false
let quitting = false
app.on("before-quit", () => {
  quitting = true
  // A second instance quits at once and must not overwrite the first one's record.
  if (launchRecord.startedAt > 0) saveLaunchRecord({ quit: true })
})
app.on("will-quit", (event) => {
  const stopping = server
  if (serverStopped || !stopping) return
  event.preventDefault()
  serverStopped = true
  const timer = setTimeout(() => {
    stopping.kill()
    app.quit()
  }, SERVER_STOP_TIMEOUT_MS)
  stopping.once("exit", () => {
    clearTimeout(timer)
    app.quit()
  })
  stopping.postMessage({ type: "shutdown" })
})

app.on("second-instance", () => {
  if (openInBackground) return
  const [window] = BrowserWindow.getAllWindows()
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
})

const ivinHome = process.env["IVIN_HOME"] ?? join(homedir(), app.isPackaged ? ".ivin" : ".ivin-dev")
const logPath = join(ivinHome, "logs", "ivin.log")

const setServerState = (state: ServerState) => {
  serverState = state
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(SERVER_STATE, state)
}
ipcMain.handle(GET_SERVER_STATE, () => serverState)
ipcMain.handle(RESTART_SERVER, () => {
  if (serverState.kind !== "gave-up") return
  setServerState({ kind: "restarting" })
  startServer({ manual: true })
})

// Only a packaged macOS arm64 build ships a zip an update can replace itself with.
const updatesEnabled = app.isPackaged && process.platform === "darwin" && process.arch === "arm64"
const settingsFile = join(ivinHome, "settings.json")
// Contents/MacOS/ivin sits two folders inside ivin.app.
const appBundle = dirname(dirname(dirname(app.getPath("exe"))))
const readSettings = () => {
  try {
    return readFileSync(settingsFile, "utf8")
  } catch {
    return null
  }
}
let relaunchToUpdate = false
const updater = createUpdater({
  releasesUrl:
    process.env["IVIN_UPDATE_URL"] ?? "https://api.github.com/repos/pchmn-labs/ivin/releases",
  current: app.getVersion(),
  bundle: appBundle,
  folder: join(app.getPath("userData"), "updates"),
  autoCheck: () => automaticCheckFrom(readSettings()),
  beta: () => betaFrom(readSettings(), app.getVersion()),
  onState: (state) => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send(UPDATE_STATE, state)
  },
})
ipcMain.handle(GET_UPDATE_STATE, () => updater.state())
ipcMain.handle(CHECK_FOR_UPDATES, async () => {
  if (updatesEnabled) await updater.check({ manual: true })
  return updater.state()
})
ipcMain.handle(RESTART_TO_UPDATE, () => {
  if (updater.state().kind !== "ready") return
  relaunchToUpdate = true
  app.quit()
})
app.on("quit", () => {
  const staged = updater.staged()
  if (!staged) return
  startSwap({
    pid: process.pid,
    target: appBundle,
    staged: staged.bundle,
    relaunch: relaunchToUpdate,
    args: process.argv.slice(1),
  })
})

ipcMain.handle(OPEN_SETTINGS_FILE, async () => {
  const file = join(ivinHome, "settings.json")
  try {
    await mkdir(ivinHome, { recursive: true, mode: 0o700 })
    // The system has nothing to open until a setting is first changed.
    await writeFile(file, "{}\n", { flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error
    })
  } catch (error) {
    return String(error)
  }
  const failure = await shell.openPath(file)
  return failure === "" ? null : `could not open ${file}: ${failure}`
})

ipcMain.handle(SHOW_IN_FOLDER, (_event, path: unknown) => {
  if (typeof path === "string" && isAbsolute(path)) shell.showItemInFolder(path)
})

void app.whenReady().then(() => {
  if (!isFirstInstance) return
  if (devBuild) {
    app.dock?.setIcon(join(import.meta.dirname, "../build/icon.png"))
    app.dock?.setBadge("DEV")
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(appMenuTemplate(process.platform)))
  const imageFolder = join(app.getPath("userData"), "images")
  protocol.handle(IMAGE_SCHEME, async (request) => {
    const file = imageFile(imageFolder, request.url)
    if (!file) return new Response(null, { status: 404 })
    const response = await net.fetch(pathToFileURL(file).toString())
    return new Response(response.body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "",
        "access-control-allow-origin": "*",
      },
    })
  })
  protocol.handle(PLUGIN_SCHEME, async (request) => {
    const file = await pluginFile(pluginsFolder, request.url)
    return file ? net.fetch(pathToFileURL(file).toString()) : new Response(null, { status: 404 })
  })
  const bundleFolder = join(ivinHome, "cache", "plugins")
  protocol.handle(PLUGIN_BUNDLE_SCHEME, async (request) => {
    const file = pluginBundleFile(bundleFolder, builtinPluginsFolder, request.url)
    if (!file) return new Response(null, { status: 404 })
    const response = await net.fetch(pathToFileURL(file).toString())
    return new Response(response.body, {
      status: response.status,
      headers: { "content-type": "text/javascript", "access-control-allow-origin": "*" },
    })
  })
  const cliFolder = join(app.getPath("userData"), "bin")
  const cliCommand = writeCliCommand(cliFolder, process.execPath, cliEntry)
  launchMode = launchModeFrom(
    parseLaunchRecord(readFileOrNull(launchFile())),
    process.argv.slice(1),
  )
  saveLaunchRecord({ startedAt: Date.now(), settled: false, quit: false })
  const serverArgs = [
    ...(launchMode.kind === "safe" ? [SAFE_ARGUMENT] : []),
    "--database",
    join(app.getPath("userData"), "ivin.db"),
    "--log",
    logPath,
    "--home",
    ivinHome,
    "--images",
    imageFolder,
    "--skills",
    skillsFolder,
    "--pnpm",
    pnpmFolder,
    "--plugin-tools",
    pluginToolsFolder,
    "--cli-command",
    cliCommand,
    "--builtin-plugins",
    builtinPluginsFolder,
    "--plugin-host",
    pluginHostEntry,
    "--plugin-host-runtime",
    process.execPath,
  ]
  let nextRestart = createRestartPolicy()
  startServer = (options) => {
    if (options?.manual) nextRestart = createRestartPolicy()
    const started = utilityProcess.fork(serverEntry, serverArgs, {
      serviceName: "ivin-server",
      stdio: "inherit",
      env: {
        ...process.env,
        IVIN_SOCKET: join(ivinHome, "run", "ivin.sock"),
        PATH: [cliFolder, process.env["PATH"]].filter(Boolean).join(delimiter),
      },
    })
    server = started
    let answered = false
    started.on("message", (message: { type?: string }) => {
      if (message.type !== "ready") return
      answered = true
      if (serverState.kind !== "running") setServerState({ kind: "running" })
    })
    started.once("exit", () => {
      if (server === started) server = null
      if (quitting || serverStopped) return
      if (nextRestart(Date.now(), answered) === "give-up") {
        setServerState({ kind: "gave-up", logPath })
        return
      }
      setServerState({ kind: "restarting" })
      startServer()
    })
  }
  startServer()
  if (updatesEnabled) updater.start()
  return createWindow()
})
