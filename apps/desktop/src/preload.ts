import { contextBridge, ipcRenderer } from "electron"
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
  platform: process.platform,
  devBuild: process.argv.includes(DEV_BUILD_ARGUMENT),
  showInFolder: (path: string): Promise<void> => ipcRenderer.invoke(SHOW_IN_FOLDER, path),
  getServerState: (): Promise<unknown> => ipcRenderer.invoke(GET_SERVER_STATE),
  restartServer: (): Promise<void> => ipcRenderer.invoke(RESTART_SERVER),
  onServerState: (listener: (state: unknown) => void): (() => void) => {
    const relay = (_event: unknown, state: unknown) => listener(state)
    ipcRenderer.on(SERVER_STATE, relay)
    return () => ipcRenderer.removeListener(SERVER_STATE, relay)
  },
  getStartupNotice: (): Promise<unknown> => ipcRenderer.invoke(GET_STARTUP_NOTICE),
  reportPluginActivity: (event: { id: string; phase: "activating" | "activated" }): void =>
    ipcRenderer.send(PLUGIN_ACTIVITY, event),
  reportSettled: (): void => ipcRenderer.send(LAUNCH_SETTLED),
  setWindowLayout: (layout: "panels" | "plane"): void => ipcRenderer.send(WINDOW_LAYOUT, layout),
  getUpdateState: (): Promise<unknown> => ipcRenderer.invoke(GET_UPDATE_STATE),
  checkForUpdates: (): Promise<unknown> => ipcRenderer.invoke(CHECK_FOR_UPDATES),
  restartToUpdate: (): Promise<void> => ipcRenderer.invoke(RESTART_TO_UPDATE),
  onUpdateState: (listener: (state: unknown) => void): (() => void) => {
    const relay = (_event: unknown, state: unknown) => listener(state)
    ipcRenderer.on(UPDATE_STATE, relay)
    return () => ipcRenderer.removeListener(UPDATE_STATE, relay)
  },
})
