import {
  app,
  BrowserWindow,
  ipcMain,
  MessageChannelMain,
  utilityProcess,
  type UtilityProcess,
} from "electron"
import { join } from "node:path"
import { RPC_PORT_REQUEST, RPC_PORT_REPLY } from "./channels.ts"

const devUrl = process.env["IVIN_DEV_URL"]

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
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.once("ready-to-show", () => window.show())
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

app.on("window-all-closed", () => app.quit())
app.on("will-quit", () => {
  server?.kill()
})

void app.whenReady().then(() => {
  server = utilityProcess.fork(serverEntry, [], { serviceName: "ivin-server", stdio: "inherit" })
  return createWindow()
})
