import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  MessageChannelMain,
  net,
  protocol,
  shell,
  utilityProcess,
  type UtilityProcess,
} from "electron"
import { mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { delimiter, join } from "node:path"
import { pathToFileURL } from "node:url"
import { OPEN_SETTINGS_FILE, PICK_FOLDER, RPC_PORT_REQUEST, RPC_PORT_REPLY } from "./channels.ts"
import { writeCliCommand } from "./cli-command.ts"
import { linkTarget } from "./link-target.ts"
import { IMAGE_SCHEME, imageFile } from "./image-protocol.ts"

const devUrl = process.env["IVIN_DEV_URL"]
const openInBackground = process.env["IVIN_BACKGROUND"] === "1"
// Set before ready: after it, macOS has already activated the app and shown its Dock icon.
if (openInBackground && process.platform === "darwin") app.setActivationPolicy("accessory")

// The server bundle sits at the same place inside the app (asar included) as in the repo.
const serverEntry = app.isPackaged
  ? join(app.getAppPath(), "server/main.js")
  : join(import.meta.dirname, "../../server/dist/main.js")
const cliEntry = app.isPackaged
  ? join(process.resourcesPath, "cli/ivin.js")
  : join(import.meta.dirname, "../../cli/dist/ivin.js")
const skillFolder = app.isPackaged
  ? join(process.resourcesPath, "skills/ivin-customize")
  : join(import.meta.dirname, "../../server/skills/ivin-customize")
const rendererEntry = app.isPackaged
  ? join(app.getAppPath(), "renderer/index.html")
  : join(import.meta.dirname, "../../../packages/ui/dist/index.html")
const appPage = devUrl ?? pathToFileURL(rendererEntry).toString()

process.on("uncaughtException", (error) => {
  console.error(error)
  process.exit(1)
})

let server: UtilityProcess

// Registered before ready: the window loads a user's sent images straight from their files.
protocol.registerSchemesAsPrivileged([
  { scheme: IMAGE_SCHEME, privileges: { standard: true, secure: true } },
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
ipcMain.on(RPC_PORT_REQUEST, (event) => {
  const { port1, port2 } = new MessageChannelMain()
  server.postMessage({}, [port1])
  event.sender.postMessage(RPC_PORT_REPLY, null, [port2])
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
let serverExited = false
app.on("will-quit", (event) => {
  if (serverStopped || serverExited || !server) return
  event.preventDefault()
  serverStopped = true
  const timer = setTimeout(() => {
    server.kill()
    app.quit()
  }, SERVER_STOP_TIMEOUT_MS)
  server.once("exit", () => {
    clearTimeout(timer)
    app.quit()
  })
  server.postMessage({ type: "shutdown" })
})

const ivinHome = process.env["IVIN_HOME"] ?? join(homedir(), ".ivin")

ipcMain.handle(OPEN_SETTINGS_FILE, async () => {
  const file = join(ivinHome, "settings.json")
  try {
    await mkdir(ivinHome, { recursive: true })
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

void app.whenReady().then(() => {
  if (!app.isPackaged) app.dock?.setIcon(join(import.meta.dirname, "../build/icon.png"))
  const imageFolder = join(app.getPath("userData"), "images")
  protocol.handle(IMAGE_SCHEME, (request) => {
    const file = imageFile(imageFolder, request.url)
    return file ? net.fetch(pathToFileURL(file).toString()) : new Response(null, { status: 404 })
  })
  const cliFolder = join(app.getPath("userData"), "bin")
  const cliCommand = writeCliCommand(cliFolder, process.execPath, cliEntry)
  server = utilityProcess.fork(
    serverEntry,
    [
      "--database",
      join(app.getPath("userData"), "ivin.db"),
      "--log",
      join(ivinHome, "logs", "ivin.log"),
      "--home",
      ivinHome,
      "--images",
      imageFolder,
      "--skill",
      skillFolder,
      "--cli-command",
      cliCommand,
    ],
    {
      serviceName: "ivin-server",
      stdio: "inherit",
      env: {
        ...process.env,
        IVIN_SOCKET: join(ivinHome, "run", "ivin.sock"),
        PATH: [cliFolder, process.env["PATH"]].filter(Boolean).join(delimiter),
      },
    },
  )
  server.once("exit", () => {
    serverExited = true
  })
  return createWindow()
})
