import { realpath } from "node:fs/promises"
import { join, sep } from "node:path"

export const PLUGIN_SCHEME = "ivin-plugin"

const ID = /^[a-z0-9-]+$/

const segmentsOf = (pathname: string) => {
  try {
    return pathname.slice(1).split("/").map(decodeURIComponent)
  } catch {
    return null
  }
}

export const pluginFile = async (pluginsFolder: string, url: string): Promise<string | null> => {
  if (!URL.canParse(url)) return null
  const { hostname, pathname } = new URL(url)
  const segments = segmentsOf(pathname)
  if (!ID.test(hostname) || segments === null) return null
  if (segments.some((s) => s === "" || s === "." || s === ".." || /[/\\\0]/.test(s))) return null
  const folder = join(pluginsFolder, hostname)
  try {
    // Resolved, so a symlink inside the folder cannot lead out of it.
    const [realFolder, realFile] = await Promise.all([
      realpath(folder),
      realpath(join(folder, ...segments)),
    ])
    return realFile.startsWith(realFolder + sep) ? realFile : null
  } catch {
    return null
  }
}
