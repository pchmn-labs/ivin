import { join } from "node:path"

export const PLUGIN_BUNDLE_SCHEME = "ivin-plugin-bundle"

const BUNDLE = /^[a-f0-9]{64}\.js$/

// `ivin-plugin-bundle://cache/<hash>.js` → its file in `cacheFolder`; null for any other URL.
export const pluginBundleFile = (cacheFolder: string, url: string): string | null => {
  if (!URL.canParse(url)) return null
  const { hostname, pathname } = new URL(url)
  const name = pathname.slice(1)
  return hostname === "cache" && BUNDLE.test(name) ? join(cacheFolder, name) : null
}
