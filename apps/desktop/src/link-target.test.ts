import { expect, test } from "vitest"
import { linkTarget } from "./link-target.ts"

const packagedPage = "file:///Applications/ivin.app/Contents/Resources/app.asar/renderer/index.html"
const devPage = "http://localhost:5173"

test("a web or mail link opens in the browser", () => {
  expect(linkTarget("https://github.com/pchmn-labs/ivin/pull/1", packagedPage)).toBe("browser")
  expect(linkTarget("http://example.com", devPage)).toBe("browser")
  expect(linkTarget("http://localhost:5173/src/main.ts", devPage)).toBe("browser")
  expect(linkTarget("mailto:someone@example.com", packagedPage)).toBe("browser")
})

test("the app's own page stays in the window, whatever its query or hash", () => {
  expect(linkTarget(`${packagedPage}#section`, packagedPage)).toBe("app")
  expect(linkTarget("http://localhost:5173/?reload=1", devPage)).toBe("app")
})

test("another file of the app's folder opens nowhere", () => {
  expect(linkTarget("file:///etc/passwd", packagedPage)).toBe("nowhere")
  expect(linkTarget(packagedPage.replace("index.html", "notes.md"), packagedPage)).toBe("nowhere")
})

test("another scheme or no URL opens nowhere", () => {
  expect(linkTarget("javascript:alert(1)", packagedPage)).toBe("nowhere")
  expect(linkTarget("vscode://file/tmp/a.ts", packagedPage)).toBe("nowhere")
  expect(linkTarget("not a url", packagedPage)).toBe("nowhere")
})
