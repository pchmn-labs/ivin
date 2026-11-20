import { join } from "node:path"

export const IMAGE_SCHEME = "ivin-image"

const ID = /^[a-z0-9-]+$/i
const FILE = /^[a-z0-9-]+\.(png|jpg|gif|webp)$/i

// `ivin-image://<sessionId>/<imageId>.<ext>` → its file in `folder`; null for any other URL.
export const imageFile = (folder: string, url: string): string | null => {
  if (!URL.canParse(url)) return null
  const { hostname, pathname } = new URL(url)
  const name = decodeURIComponent(pathname.slice(1))
  return ID.test(hostname) && FILE.test(name) ? join(folder, hostname, name) : null
}
