// The desktop app serves it from the plugin's folder (`apps/desktop/src/plugin-protocol.ts`).
export const pluginFileUrl = (pluginId: string, path: string) =>
  `ivin-plugin://${pluginId}/${path.split("/").map(encodeURIComponent).join("/")}`
