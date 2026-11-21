const BROWSER_PROTOCOLS = new Set(["http:", "https:", "mailto:"])

export type LinkTarget = "app" | "browser" | "nowhere"

// appOrigin is the dev server's origin, or undefined when the window loads its files.
export const linkTarget = (url: string, appOrigin: string | undefined): LinkTarget => {
  if (!URL.canParse(url)) return "nowhere"
  const { protocol, origin } = new URL(url)
  if (appOrigin ? origin === appOrigin : protocol === "file:") return "app"
  return BROWSER_PROTOCOLS.has(protocol) ? "browser" : "nowhere"
}
