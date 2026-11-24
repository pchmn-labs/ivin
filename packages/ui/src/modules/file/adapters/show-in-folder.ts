// Undefined outside the desktop app, where no file manager can be opened.
export const desktopPlatform = (): string | undefined =>
  (window as { ivin?: Window["ivin"] }).ivin?.platform

export const showInFolder = (path: string): Promise<void> => window.ivin.showInFolder(path)
