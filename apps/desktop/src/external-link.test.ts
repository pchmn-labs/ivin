import { expect, test } from "vitest"
import { linkTarget } from "./external-link.ts"

const devOrigin = "http://localhost:5173"

test("a web or mail link opens in the browser", () => {
  expect(linkTarget("https://github.com/pchmn-labs/ivin/pull/1", undefined)).toBe("browser")
  expect(linkTarget("http://example.com", devOrigin)).toBe("browser")
  expect(linkTarget("mailto:someone@example.com", undefined)).toBe("browser")
})

test("the app's own pages stay in the window", () => {
  expect(linkTarget("file:///Applications/ivin.app/renderer/index.html", undefined)).toBe("app")
  expect(linkTarget("http://localhost:5173/index.html", devOrigin)).toBe("app")
})

test("a file, another scheme or no URL opens nowhere", () => {
  expect(linkTarget("file:///etc/passwd", devOrigin)).toBe("nowhere")
  expect(linkTarget("javascript:alert(1)", undefined)).toBe("nowhere")
  expect(linkTarget("vscode://file/tmp/a.ts", undefined)).toBe("nowhere")
  expect(linkTarget("not a url", undefined)).toBe("nowhere")
})
