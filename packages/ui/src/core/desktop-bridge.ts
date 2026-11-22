declare global {
  interface Window {
    // Exposed by apps/desktop/src/preload.ts.
    readonly ivin: {
      readonly pickFolder: () => Promise<string | null>
      // Null once opened, else why the system could not open the file.
      readonly openSettingsFile: () => Promise<string | null>
    }
  }
}

export {}
