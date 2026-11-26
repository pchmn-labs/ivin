export const pluginBundleUrl = (bundle: string, builtin: boolean) =>
  `ivin-plugin-bundle://${builtin ? "builtin" : "cache"}/${encodeURIComponent(bundle)}`
