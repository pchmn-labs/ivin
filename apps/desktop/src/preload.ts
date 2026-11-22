import { contextBridge, ipcRenderer } from "electron"
import { OPEN_SETTINGS_FILE, PICK_FOLDER, RPC_PORT_REPLY, RPC_PORT_REQUEST } from "./channels.ts"

// The page cannot reach ipcRenderer, and a MessagePort cannot cross contextBridge: relay by window messages.
window.addEventListener("message", (event) => {
  if (event.source === window && event.data === "ivin:request-rpc-port") {
    ipcRenderer.send(RPC_PORT_REQUEST)
  }
})

ipcRenderer.on(RPC_PORT_REPLY, (event) => {
  window.postMessage("ivin:rpc-port", "*", [...event.ports])
})

contextBridge.exposeInMainWorld("ivin", {
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke(PICK_FOLDER),
  openSettingsFile: (): Promise<boolean> => ipcRenderer.invoke(OPEN_SETTINGS_FILE),
})
