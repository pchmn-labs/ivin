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
import { readFileSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { delimiter, dirname, isAbsolute, join } from "node:path"
import { pathToFileURL } from "node:url"
import { appMenuTemplate } from "./app-menu.ts"
import {
  CHECK_FOR_UPDATES,
  DEV_BUILD_ARGUMENT,
  GET_SERVER_STATE,
  GET_UPDATE_STATE,
  OPEN_SETTINGS_FILE,
  PICK_FOLDER,
  RESTART_SERVER,
  RESTART_TO_UPDATE,
  RPC_PORT_REPLY,
  RPC_PORT_REQUEST,
  SERVER_STATE,
  SHOW_IN_FOLDER,
  UPDATE_STATE,
} from "./channels.ts"
import { writeCliCommand } from "./cli-command.ts"
import { linkTarget } from "./link-target.ts"
import { IMAGE_SCHEME, imageFile } from "./image-protocol.ts"
import { PLUGIN_SCHEME, pluginFile } from "./plugin-protocol.ts"
import { PLUGIN_BUNDLE_SCHEME, pluginBundleFile } from "./plugin-bundle-protocol.ts"
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
const skillFolder = app.isPackaged
  ? join(process.resourcesPath, "skills/ivin-customize")
  : join(import.meta.dirname, "../../server/skills/ivin-customize")
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

const createWindow = async () => {
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    show: false,
    // The sidebar card holds the traffic lights: inset 15pt from its corner, centred on its top row.
    ...(process.platform === "darwin" && {
      titleBarStyle: "hiddenInset" as const,
      trafficLightPosition: { x: 23, y: 21 },
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

ipcMain.handle(PICK_FOLDER, async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  const options = { properties: ["openDirectory" as const] }
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
  const serverArgs = [
    "--database",
    join(app.getPath("userData"), "ivin.db"),
    "--log",
    logPath,
    "--home",
    ivinHome,
    "--images",
    imageFolder,
    "--skill",
    skillFolder,
    "--pnpm",
    pnpmFolder,
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
