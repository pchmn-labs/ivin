declare global {
  interface Window {
    // Exposed by apps/desktop/src/preload.ts.
    readonly ivin: { readonly pickFolder: () => Promise<string | null> }
  }
}

export const pickFolder = (): Promise<string | null> => window.ivin.pickFolder()
