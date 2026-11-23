import { contextBridge, ipcRenderer } from "electron"
import {
  GET_SERVER_STATE,
  OPEN_SETTINGS_FILE,
  PICK_FOLDER,
  RESTART_SERVER,
  RPC_PORT_REPLY,
  RPC_PORT_REQUEST,
  SERVER_STATE,
} from "./channels.ts"

// The page cannot reach ipcRenderer, and a MessagePort cannot cross contextBridge: relay by window messages.
window.addEventListener("message", (event) => {
  const data = event.data as { type?: unknown; id?: unknown } | null
  if (event.source === window && data?.type === "ivin:request-rpc-port") {
    ipcRenderer.send(RPC_PORT_REQUEST, data.id)
  }
})

ipcRenderer.on(RPC_PORT_REPLY, (event, id: unknown) => {
  window.postMessage({ type: "ivin:rpc-port", id }, "*", [...event.ports])
})

contextBridge.exposeInMainWorld("ivin", {
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke(PICK_FOLDER),
  openSettingsFile: (): Promise<string | null> => ipcRenderer.invoke(OPEN_SETTINGS_FILE),
  getServerState: (): Promise<unknown> => ipcRenderer.invoke(GET_SERVER_STATE),
  restartServer: (): Promise<void> => ipcRenderer.invoke(RESTART_SERVER),
  onServerState: (listener: (state: unknown) => void): (() => void) => {
    const relay = (_event: unknown, state: unknown) => listener(state)
    ipcRenderer.on(SERVER_STATE, relay)
    return () => ipcRenderer.removeListener(SERVER_STATE, relay)
  },
})
