import type { UpdateState } from "@ivin/contracts/update"

export type ServerState =
  | { readonly kind: "running" }
  | { readonly kind: "restarting" }
  | { readonly kind: "gave-up"; readonly logPath: string }

declare global {
  interface Window {
    // Exposed by apps/desktop/src/preload.ts.
    readonly ivin: {
      readonly pickFolder: () => Promise<string | null>
      // Null once opened, else why the system could not open the file.
      readonly openSettingsFile: () => Promise<string | null>
      // Node's `process.platform`.
      readonly platform: string
      // True in a build that is not packaged.
      readonly devBuild: boolean
      // Opens the system's file manager on the folder of `path`, with `path` selected.
      readonly showInFolder: (path: string) => Promise<void>
      readonly getServerState: () => Promise<ServerState>
      readonly restartServer: () => Promise<void>
      // Returns the function that stops listening.
      readonly onServerState: (listener: (state: ServerState) => void) => () => void
      readonly getUpdateState: () => Promise<UpdateState>
      // Runs a check now, and resolves with the state it ends in.
      readonly checkForUpdates: () => Promise<UpdateState>
      readonly restartToUpdate: () => Promise<void>
      readonly onUpdateState: (listener: (state: UpdateState) => void) => () => void
      // A `StartupNotice` from @ivin/contracts/plugin, or null when the window started as usual.
      readonly getStartupNotice: () => Promise<unknown>
      // Lets the desktop app name the plugin a window that stops answering was running.
      readonly reportPluginActivity: (activity: {
        readonly id: string
        readonly phase: "activating" | "activated"
      }) => void
      // The window rendered with every initial plugin active.
      readonly reportSettled: () => void
      // Moves the macOS traffic lights onto the layout's top row.
      readonly setWindowLayout: (layout: "panels" | "plane") => void
    }
  }
}
