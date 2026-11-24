import { join } from "node:path"

export const PLUGIN_BUNDLE_SCHEME = "ivin-plugin-bundle"

// The entry, or a chunk in the folder named after it.
const BUNDLE = /^[a-f0-9]{64}(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)?\.js$/

// `ivin-plugin-bundle://cache/<hash>.js` → its file (entry or chunk) in `cacheFolder`; null for any other URL.
export const pluginBundleFile = (cacheFolder: string, url: string): string | null => {
  if (!URL.canParse(url)) return null
  const { hostname, pathname } = new URL(url)
  const name = pathname.slice(1)
  return hostname === "cache" && BUNDLE.test(name) ? join(cacheFolder, name) : null
}
