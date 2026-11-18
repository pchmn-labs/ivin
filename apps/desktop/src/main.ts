import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  MessageChannelMain,
  utilityProcess,
  type UtilityProcess,
} from "electron"
import { join } from "node:path"
import { PICK_FOLDER, RPC_PORT_REQUEST, RPC_PORT_REPLY } from "./channels.ts"

const devUrl = process.env["IVIN_DEV_URL"]
const background = process.env["IVIN_BACKGROUND"] === "1"

// The server bundle sits at the same place inside the app (asar included) as in the repo.
const serverEntry = app.isPackaged
  ? join(app.getAppPath(), "server/main.js")
  : join(import.meta.dirname, "../../server/dist/main.js")
const rendererEntry = join(app.getAppPath(), "renderer/index.html")

process.on("uncaughtException", (error) => {
  console.error(error)
  process.exit(1)
})

let server: UtilityProcess

const createWindow = async () => {
  // Must precede the window: macOS activates the app when its first window shows.
  if (background && process.platform === "darwin") app.setActivationPolicy("accessory")
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
    },
  })
  window.once("ready-to-show", () => (background ? window.showInactive() : window.show()))
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

void app.whenReady().then(() => {
  if (!app.isPackaged) app.dock?.setIcon(join(import.meta.dirname, "../build/icon.png"))
  server = utilityProcess.fork(
    serverEntry,
    ["--database", join(app.getPath("userData"), "ivin.db")],
    { serviceName: "ivin-server", stdio: "inherit" },
  )
  server.once("exit", () => {
    serverExited = true
  })
  return createWindow()
})
