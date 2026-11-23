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
      readonly getServerState: () => Promise<ServerState>
      readonly restartServer: () => Promise<void>
      // Returns the function that stops listening.
      readonly onServerState: (listener: (state: ServerState) => void) => () => void
    }
  }
}
