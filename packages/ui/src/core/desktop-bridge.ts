declare global {
  interface Window {
    // Exposed by apps/desktop/src/preload.ts.
    readonly ivin: {
      readonly pickFolder: () => Promise<string | null>
      // False when the system could not open the file.
      readonly openSettingsFile: () => Promise<boolean>
    }
  }
}

export {}
