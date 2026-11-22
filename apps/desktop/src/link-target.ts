const BROWSER_PROTOCOLS = new Set(["http:", "https:", "mailto:"])

export type LinkTarget = "app" | "browser" | "nowhere"

const withoutQueryOrHash = ({ protocol, host, pathname }: URL) => `${protocol}//${host}${pathname}`

export const linkTarget = (url: string, appPage: string): LinkTarget => {
  if (!URL.canParse(url)) return "nowhere"
  const target = new URL(url)
  if (withoutQueryOrHash(target) === withoutQueryOrHash(new URL(appPage))) return "app"
  return BROWSER_PROTOCOLS.has(target.protocol) ? "browser" : "nowhere"
}
