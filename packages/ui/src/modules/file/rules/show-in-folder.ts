export const showInFolderLabel = (platform: string): string =>
  platform === "darwin"
    ? "Show in Finder"
    : platform === "win32"
      ? "Show in File Explorer"
      : "Show in Folder"
