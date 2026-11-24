import { RegistryProvider } from "@effect/atom-react"
import type { FolderEntry } from "@ivin/contracts/file"
import { DateTime } from "effect"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer, type FakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { App } from "./app.tsx"

const project = "/dev/shop"
const worktree = "/dev/shop/.worktrees/fix-cart"

const folder = (...names: string[]): ReadonlyArray<FolderEntry> =>
  names.map((name) =>
    name.endsWith("/")
      ? { name: name.slice(0, -1), kind: "folder", ignored: false }
      : { name, kind: "file", ignored: false },
  )

const makeServer = () => {
  const server = makeFakeServer({
    project: { path: project, name: "shop", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  const at = DateTime.makeUnsafe(0)
  for (const [id, title, workingFolder] of [
    ["s1", "Checkout flow", project],
    ["s2", "Fix the cart", worktree],
  ] as const) {
    server.sessions.set(id, {
      id,
      projectPath: project,
      workingFolder,
      inWorktree: workingFolder !== project,
      branch: "main",
      started: true,
      workingFolderDeleted: false,
      title,
      harness: "claude",
      model: "sonnet",
      effort: "high",
      permissionMode: "manual",
      relaunchFailure: null,
      pendingMessages: [],
      unreadMessages: [],
      backgroundTasks: [],
      status: "idle",
      statusChangedAt: at,
      createdAt: at,
      lastActivityAt: at,
      archivedAt: null,
      lastImageNumber: 0,
      waitingFor: null,
    })
  }
  server.folders.set(project, folder("src/", "logo.png", "bundle.js", "gone.ts", "README.md"))
  server.folders.set(`${project}/src`, folder("main.ts"))
  server.folders.set(worktree, folder("notes.md"))
  server.files.set(`${project}/README.md`, { kind: "text", text: "# Shop\n" })
  server.files.set(`${project}/src/main.ts`, { kind: "text", text: 'export const shop = "open"\n' })
  server.files.set(`${project}/logo.png`, { kind: "binary" })
  server.files.set(`${project}/bundle.js`, {
    kind: "too_large",
    size: 3 * 1024 * 1024,
    limit: 2 * 1024 * 1024,
  })
  server.openTab("s2")
  server.openTab("s1")
  return server
}

const mount = (server: FakeServer) =>
  render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ height: 800 }}>
        <App />
      </div>
    </RegistryProvider>,
  )

const showFiles = async () => {
  await page.getByRole("tablist", { name: "Sidebar" }).getByRole("tab", { name: "Files" }).click()
}
const item = (name: string) => page.getByRole("treeitem", { name, exact: true })
const card = () => page.getByRole("region", { name: "Open files" })
const fileTab = (name: string) =>
  card().getByRole("tablist", { name: "Open files" }).getByRole("tab", { name })
const code = (name: string) => page.getByRole("textbox", { name })
const sessionTab = (title: string) => page.getByTestId("tab").filter({ hasText: title })

beforeEach(async () => {
  localStorage.clear()
  await page.viewport(1400, 800)
})
afterEach(() => localStorage.clear())

test("a file opened from the tree shows beside the chat, in a tab of its own", async () => {
  const server = makeServer()
  await mount(server)
  await showFiles()
  await item("README.md").click()

  await expect.element(fileTab("README.md")).toHaveAttribute("aria-selected", "true")
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
  expect(server.subViews.get("s1")?.subViews).toEqual([{ kind: "file", path: "README.md" }])
})

test("several files stay open; the last opened is selected, and a tab selects its file", async () => {
  await mount(makeServer())
  await showFiles()
  await item("README.md").click()
  await item("src").click()
  await item("main.ts").click()

  await expect.element(fileTab("main.ts")).toHaveAttribute("aria-selected", "true")
  await expect.element(code("main.ts")).toHaveTextContent('export const shop = "open"')
  await fileTab("README.md").click()
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
  await expect.element(fileTab("main.ts")).toHaveAttribute("aria-selected", "false")
})

test("the arrow keys move between the open files", async () => {
  await mount(makeServer())
  await showFiles()
  await item("README.md").click()
  await item("logo.png").click()
  await fileTab("logo.png").click()

  await userEvent.keyboard("{ArrowLeft}")
  await expect.element(fileTab("README.md")).toHaveAttribute("aria-selected", "true")
  await expect.element(fileTab("README.md")).toHaveFocus()
})

test("closing a file selects its neighbour, and closing the last one closes the card", async () => {
  const server = makeServer()
  await mount(server)
  await showFiles()
  await item("README.md").click()
  await item("logo.png").click()

  await page.getByRole("button", { name: "Close logo.png", includeHidden: true }).click()
  await expect.element(fileTab("logo.png")).not.toBeInTheDocument()
  await expect.element(fileTab("README.md")).toHaveAttribute("aria-selected", "true")

  await page.getByRole("button", { name: "Close README.md", includeHidden: true }).click()
  await expect.element(card()).not.toBeInTheDocument()
  expect(server.subViews.get("s1")?.subViews).toEqual([])
})

test("a large file and a binary file say why they are not shown", async () => {
  await mount(makeServer())
  await showFiles()
  await item("bundle.js").click()
  await expect
    .element(card().getByText("bundle.js is 3 MB, over the 2 MB ivin shows, so it is not shown."))
    .toBeVisible()
  await item("logo.png").click()
  await expect
    .element(card().getByText("logo.png is a binary file, so it is not shown."))
    .toBeVisible()
})

test("a file that is gone says so in its place, and Retry reads it again", async () => {
  const server = makeServer()
  await mount(server)
  await showFiles()
  await item("gone.ts").click()

  await expect
    .element(card().getByText("gone.ts no longer exists. Retry once it is back."))
    .toBeVisible()
  server.files.set(`${project}/gone.ts`, { kind: "text", text: "back()\n" })
  await card().getByRole("button", { name: "Retry" }).click()
  await expect.element(code("gone.ts")).toHaveTextContent("back()")
})

test("a file that cannot be read says to check its permissions", async () => {
  const server = makeServer()
  server.files.set(`${project}/gone.ts`, "unreadable")
  await mount(server)
  await showFiles()
  await item("gone.ts").click()
  await expect
    .element(card().getByText("gone.ts could not be read. Check its permissions, then retry."))
    .toBeVisible()
})

test("switching sessions and back keeps the open files and the selected one", async () => {
  await mount(makeServer())
  await showFiles()
  await item("README.md").click()
  await item("logo.png").click()
  await fileTab("README.md").click()

  await sessionTab("Fix the cart").getByRole("tab").click()
  await expect.element(card()).not.toBeInTheDocument()
  await sessionTab("Checkout flow").getByRole("tab").click()
  await expect.element(fileTab("README.md")).toHaveAttribute("aria-selected", "true")
  await expect.element(fileTab("logo.png")).toBeVisible()
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
})

test("the open files are back at launch, from the server", async () => {
  const server = makeServer()
  server.subViews.set("s1", {
    sessionId: "s1",
    subViews: [
      { kind: "file", path: "README.md" },
      { kind: "file", path: "src/main.ts" },
    ],
    selected: { kind: "file", path: "src/main.ts" },
    fullWidth: false,
    sessionTabSelected: false,
  })
  await mount(server)
  await expect.element(fileTab("main.ts")).toHaveAttribute("aria-selected", "true")
  await expect.element(fileTab("README.md")).toBeVisible()
  await expect.element(code("main.ts")).toHaveTextContent('export const shop = "open"')
})

test("a file opened with Enter in the tree keeps the focus in the tree", async () => {
  await mount(makeServer())
  await showFiles()
  ;(page.getByRole("tree", { name: "Files" }).element() as HTMLElement).focus()
  await userEvent.keyboard("{End}{Enter}")
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
  await expect.element(page.getByRole("tree", { name: "Files" })).toHaveFocus()
})

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"

test("the Close file keybinding closes the selected file", async () => {
  await mount(makeServer())
  await showFiles()
  await item("README.md").click()
  await item("logo.png").click()

  await userEvent.keyboard(`{${mod}>}{Shift>}w{/Shift}{/${mod}}`)
  await expect.element(fileTab("logo.png")).not.toBeInTheDocument()
  await expect.element(fileTab("README.md")).toHaveAttribute("aria-selected", "true")
})

test("a close that fails keeps the file and says so, and Retry closes it", async () => {
  const server = makeServer()
  await mount(server)
  await showFiles()
  await item("README.md").click()
  server.failNextCall("tab.closeSubView")

  await page.getByRole("button", { name: "Close README.md", includeHidden: true }).click()
  await expect.element(card().getByText("README.md could not be closed. Retry.")).toBeVisible()
  await expect.element(fileTab("README.md")).toBeVisible()
  await card().getByRole("button", { name: "Retry" }).click()
  await expect.element(card()).not.toBeInTheDocument()
})

test("a file keeps its scroll position when another file or session comes and goes", async () => {
  const server = makeServer()
  const long = Array.from({ length: 2000 }, (_, n) => `line ${n}`).join("\n")
  server.files.set(`${project}/src/main.ts`, { kind: "text", text: long })
  await mount(server)
  await showFiles()
  await item("README.md").click()
  await item("src").click()
  await item("main.ts").click()
  await expect.element(code("main.ts").getByText("line 0", { exact: true })).toBeVisible()

  const scroller = () => document.querySelector<HTMLElement>(".iv-sub-view-card .cm-scroller")!
  scroller().scrollTop = 6000
  scroller().dispatchEvent(new Event("scroll"))
  await fileTab("README.md").click()
  await expect.element(code("README.md")).toBeVisible()
  await sessionTab("Fix the cart").getByRole("tab").click()
  await sessionTab("Checkout flow").getByRole("tab").click()
  await fileTab("main.ts").click()
  await expect.element(code("main.ts")).toBeVisible()
  await expect.poll(() => scroller().scrollTop).toBe(6000)
})

const answer = (text: string) => ({
  sessionId: "s1",
  id: "a1",
  position: 0,
  at: 0,
  type: "message" as const,
  role: "assistant" as const,
  text,
  images: [],
  steer: false,
})
const transcriptLink = (name: string) => page.getByRole("link", { name, exact: true })
const longMain = Array.from({ length: 2000 }, (_, n) => `line ${n + 1}`).join("\n")

test("a file linked in an agent's answer opens beside the chat", async () => {
  const server = makeServer()
  server.seedItems("s1", [answer("See [the readme](README.md) and [main](/dev/shop/src/main.ts).")])
  await mount(server)
  await transcriptLink("the readme").click()
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
  await transcriptLink("main").click()
  await expect.element(fileTab("main.ts")).toHaveAttribute("aria-selected", "true")
  expect(server.subViews.get("s1")?.subViews).toEqual([
    { kind: "file", path: "README.md" },
    { kind: "file", path: "src/main.ts" },
  ])
})

test("a linked line opens the file scrolled to it, and another link to the file moves there", async () => {
  const server = makeServer()
  server.files.set(`${project}/src/main.ts`, { kind: "text", text: longMain })
  server.seedItems("s1", [answer("[start](src/main.ts:1500) and [end](src/main.ts#L1900-L1905)")])
  await mount(server)
  await transcriptLink("start").click()
  await expect.element(code("main.ts").getByText("line 1500", { exact: true })).toBeInViewport()
  await transcriptLink("end").click()
  await expect.element(code("main.ts").getByText("line 1900", { exact: true })).toBeInViewport()
})

test("a file link opens with the keyboard", async () => {
  const server = makeServer()
  server.seedItems("s1", [answer("[the readme](./README.md)")])
  await mount(server)
  await expect.element(transcriptLink("the readme")).toBeVisible()
  ;(transcriptLink("the readme").element() as HTMLElement).focus()
  await userEvent.keyboard("{Enter}")
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
})

test("a web link is left to the browser and opens no file", async () => {
  const server = makeServer()
  server.seedItems("s1", [answer("[ivin](https://github.com/pchmn-labs/ivin)")])
  await mount(server)
  await expect
    .element(transcriptLink("ivin"))
    .toHaveAttribute("href", "https://github.com/pchmn-labs/ivin")
})

const outsideBar = () =>
  page.getByText(".zshrc is outside the working folder, so it cannot be edited.")

test("a link outside the working folder opens the file read-only, under a bar that says so", async () => {
  const server = makeServer()
  server.files.set("/Users/me/.zshrc", { kind: "text", text: 'export EDITOR="vim"\n' })
  server.seedItems("s1", [answer("[zshrc](/Users/me/.zshrc)")])
  await mount(server)
  await transcriptLink("zshrc").click()
  await expect.element(code(".zshrc")).toHaveTextContent('export EDITOR="vim"')
  await expect.element(outsideBar()).toBeVisible()
  ;(code(".zshrc").element() as HTMLElement).focus()
  await userEvent.keyboard("xyz")
  await expect.element(code(".zshrc")).toHaveTextContent('export EDITOR="vim"')
  expect(server.subViews.get("s1")?.subViews).toEqual([{ kind: "file", path: "/Users/me/.zshrc" }])
})

test("the bar of a file outside the working folder shows it in the platform's file manager", async () => {
  const showInFolder = vi.fn(() => Promise.resolve())
  vi.stubGlobal("ivin", { platform: "darwin", showInFolder })
  try {
    const server = makeServer()
    server.files.set("/Users/me/.zshrc", { kind: "text", text: "alias gs=git\n" })
    server.seedItems("s1", [answer("See `/Users/me/.zshrc:1`.")])
    await mount(server)
    await transcriptLink("/Users/me/.zshrc:1").click()
    await page.getByRole("button", { name: "Show in Finder" }).click()
    expect(showInFolder).toHaveBeenCalledWith("/Users/me/.zshrc")
  } finally {
    vi.unstubAllGlobals()
  }
})

test("a path in inline code opens its file scrolled to its line, with the mouse or the keyboard", async () => {
  const server = makeServer()
  server.files.set(`${project}/src/main.ts`, { kind: "text", text: longMain })
  server.seedItems("s1", [answer("Start in `src/main.ts:1500`, then read `README.md`.")])
  await mount(server)
  await transcriptLink("src/main.ts:1500").click()
  await expect.element(code("main.ts").getByText("line 1500", { exact: true })).toBeInViewport()
  ;(transcriptLink("README.md").element() as HTMLElement).focus()
  await userEvent.keyboard("{Enter}")
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
})

test("an absolute path or a file URL in inline code opens the same file", async () => {
  const server = makeServer()
  server.seedItems("s1", [answer("`/dev/shop/README.md` and `file:///dev/shop/src/main.ts`")])
  await mount(server)
  await transcriptLink("/dev/shop/README.md").click()
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
  await transcriptLink("file:///dev/shop/src/main.ts").click()
  await expect.element(fileTab("main.ts")).toHaveAttribute("aria-selected", "true")
})

test("inline code that is not a path, or code in a block, stays plain code", async () => {
  const server = makeServer()
  server.seedItems("s1", [
    answer("Run `npm install`, call `foo()`, see `https://example.com`.\n\n```\nsrc/main.ts\n```"),
  ])
  await mount(server)
  await expect.element(page.getByText("npm install")).toBeVisible()
  expect(page.getByRole("link").elements()).toEqual([])
})

test("inline code naming a branch, a property or a file the working folder does not hold stays plain code", async () => {
  const server = makeServer()
  server.seedItems("s1", [
    answer("Rebase on `origin/main`, log with `console.log`, see `src/old.ts`."),
  ])
  await mount(server)
  await expect.element(page.getByText("src/old.ts")).toBeVisible()
  await expect.poll(() => server.fileListings()).toBeGreaterThan(0)
  expect(page.getByRole("link").elements()).toEqual([])
})

test("a domain in inline code links to its web page", async () => {
  const server = makeServer()
  server.seedItems("s1", [answer("Published on `github.com/pchmn-labs/ivin`.")])
  await mount(server)
  await expect
    .element(transcriptLink("github.com/pchmn-labs/ivin"))
    .toHaveAttribute("href", "https://github.com/pchmn-labs/ivin")
})

test("a file the agent creates after its answer becomes a link to it", async () => {
  const server = makeServer()
  server.files.set(`${project}/bin/shop`, { kind: "text", text: "#!/bin/sh\n" })
  server.seedItems("s1", [answer("Run `bin/shop`.")])
  await mount(server)
  await expect.poll(() => server.fileListings()).toBeGreaterThan(0)
  await expect.element(transcriptLink("bin/shop")).not.toBeInTheDocument()
  server.folders.set(project, [...server.folders.get(project)!, ...folder("bin/")])
  server.folders.set(`${project}/bin`, folder("shop"))
  server.changeOnDisk(project, ["bin/shop"])
  await transcriptLink("bin/shop").click()
  await expect.element(code("shop")).toHaveTextContent("#!/bin/sh")
})

test("the file on a tool row that read it opens beside the chat", async () => {
  const server = makeServer()
  server.seedItems("s1", [
    {
      sessionId: "s1",
      id: "t1",
      position: 0,
      at: 0,
      type: "tool_call" as const,
      toolCallId: "tc1",
      name: "Read",
      kind: "read" as const,
      input: { file_path: "/dev/shop/README.md" },
      status: "done" as const,
      output: "# Shop",
    },
  ])
  await mount(server)
  await transcriptLink("/dev/shop/README.md").click()
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
})

test("a linked file that fails to open says so next to the answer, and Retry opens it", async () => {
  const server = makeServer()
  server.seedItems("s1", [answer("[the readme](README.md)")])
  await mount(server)
  server.failNextCall("tab.openSubView")
  await transcriptLink("the readme").click()
  await expect.element(page.getByText("README.md could not be opened. Retry.")).toBeVisible()
  await page.getByRole("button", { name: "Retry" }).click()
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
  await expect
    .element(page.getByText("README.md could not be opened. Retry."))
    .not.toBeInTheDocument()
})

test("a linked file that does not exist opens with the file view's message", async () => {
  const server = makeServer()
  server.seedItems("s1", [answer("[old](src/old.ts:3)")])
  await mount(server)
  await transcriptLink("old").click()
  await expect
    .element(card().getByText("old.ts no longer exists. Retry once it is back."))
    .toBeVisible()
})

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
const GIF = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
const jpeg = () => {
  const canvas = document.createElement("canvas")
  canvas.width = 3
  canvas.height = 2
  return canvas.toDataURL("image/jpeg").split(",")[1]!
}
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>\n'
const image = (name: string) => card().getByRole("img", { name })

test("a png, a jpg, a gif and an svg open as images, each with its size", async () => {
  const server = makeServer()
  server.folders.set(project, folder("logo.png", "photo.jpg", "spin.gif", "mark.svg"))
  server.files.set(`${project}/logo.png`, {
    kind: "image",
    mimeType: "image/png",
    data: PNG,
    version: "1",
  })
  server.files.set(`${project}/photo.jpg`, {
    kind: "image",
    mimeType: "image/jpeg",
    data: jpeg(),
    version: "1",
  })
  server.files.set(`${project}/spin.gif`, {
    kind: "image",
    mimeType: "image/gif",
    data: GIF,
    version: "1",
  })
  server.files.set(`${project}/mark.svg`, { kind: "text", text: SVG })
  await mount(server)
  await showFiles()
  await item("logo.png").click()
  await expect.element(image("logo.png")).toBeVisible()
  await expect.element(card().getByText(/^1 × 1 · \d+ B$/)).toBeVisible()
  await item("photo.jpg").click()
  await expect.element(card().getByText(/^3 × 2 · /)).toBeVisible()
  await item("spin.gif").click()
  await expect.element(image("spin.gif")).toBeVisible()
  await item("mark.svg").click()
  await expect.element(card().getByText(/^4 × 4 · /)).toBeVisible()
})

test("an svg switches to its source, editable, and back to the image", async () => {
  const server = makeServer()
  server.folders.set(project, folder("mark.svg"))
  server.files.set(`${project}/mark.svg`, { kind: "text", text: SVG })
  await mount(server)
  await showFiles()
  await item("mark.svg").click()
  await expect.element(image("mark.svg")).toBeVisible()
  await card().getByRole("button", { name: "Source" }).click()
  await expect.poll(() => code("mark.svg").element().textContent).toContain("rect width")
  ;(code("mark.svg").element() as HTMLElement).focus()
  await userEvent.keyboard("<!-- -->")
  await expect.poll(() => code("mark.svg").element().textContent).toContain("<!-- --><svg")
  await card().getByRole("button", { name: "Image" }).click()
  await expect.element(image("mark.svg")).toBeVisible()
})

test("an image over the limit, and one that does not decode, say so in place of the image", async () => {
  const server = makeServer()
  server.folders.set(project, folder("demo.gif", "broken.png"))
  server.files.set(`${project}/demo.gif`, {
    kind: "too_large",
    size: 48 * 1024 * 1024,
    limit: 10 * 1024 * 1024,
  })
  server.files.set(`${project}/broken.png`, {
    kind: "image",
    mimeType: "image/png",
    data: btoa("not a png"),
    version: "1",
  })
  await mount(server)
  await showFiles()
  await item("demo.gif").click()
  await expect
    .element(card().getByText("demo.gif is 48 MB, over the 10 MB ivin shows, so it is not shown."))
    .toBeVisible()
  await item("broken.png").click()
  await expect
    .element(
      card().getByText(
        "broken.png cannot be shown: its data is damaged or in a format ivin cannot read.",
      ),
    )
    .toBeVisible()
  await expect.element(card().getByRole("img")).not.toBeInTheDocument()
})

test("an image changed on disk shows again", async () => {
  const server = makeServer()
  server.folders.set(project, folder("logo.png"))
  server.files.set(`${project}/logo.png`, {
    kind: "image",
    mimeType: "image/png",
    data: PNG,
    version: "1",
  })
  await mount(server)
  await showFiles()
  await item("logo.png").click()
  await expect.element(card().getByText(/^1 × 1 · /)).toBeVisible()
  server.files.set(`${project}/logo.png`, {
    kind: "image",
    mimeType: "image/jpeg",
    data: jpeg(),
    version: "2",
  })
  server.changeOnDisk(project, ["logo.png"])
  await expect.element(card().getByText(/^3 × 2 · /)).toBeVisible()
})

const resizeHandle = () => page.getByRole("separator", { name: "Resize the files card" })
const cardWidth = () => card().element().getBoundingClientRect().width

test("a file's tab shows the icon theme's icon for it", async () => {
  await mount(makeServer())
  await showFiles()
  await item("README.md").click()

  await expect
    .poll(() => fileTab("README.md").element().querySelector("img")?.getAttribute("src"))
    .toMatch(/^ivin-plugin:\/\/file-icons\/icons\/.+\.svg$/)
})

test("the files card's left edge resizes it, keeps the chat's minimum width, and the size is kept", async () => {
  const server = makeServer()
  const first = await mount(server)
  await showFiles()
  await item("README.md").click()
  await expect.element(resizeHandle()).toBeInTheDocument()
  const start = cardWidth()

  ;(resizeHandle().element() as HTMLElement).focus()
  await userEvent.keyboard("{ArrowLeft}{ArrowLeft}")
  await expect.poll(cardWidth).toBe(Math.round(start) + 32)

  const handle = resizeHandle().element()
  for (let i = 0; i < 60; i++)
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }))
  const chat = page.getByRole("main").element().querySelector(".iv-tab-view__session")!
  expect(chat.getBoundingClientRect().width).toBeGreaterThanOrEqual(320)
  const widest = cardWidth()
  await first.unmount()

  await mount(server)
  await expect.poll(cardWidth).toBe(widest)
})

test("the files card in full width has no resize handle", async () => {
  await mount(makeServer())
  await showFiles()
  await item("README.md").click()
  await card().getByRole("button", { name: "Full width" }).click()
  await expect.element(resizeHandle()).not.toBeInTheDocument()
})
