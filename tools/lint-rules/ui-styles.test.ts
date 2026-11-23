import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import stylelint from "stylelint"
import { afterAll, beforeAll, describe, expect, test } from "vitest"

const root = resolve(import.meta.dirname, "../..")
const sandbox = mkdtempSync(join(tmpdir(), "ivin-ui-lint-"))
const ui = "packages/ui/src"

// Overrides globs resolve from the config's folder; each fixture sits in its own numbered folder, so it keeps its file name.
const inFixtureFolder = (config: string) => config.replaceAll(`"${ui}/`, `"*/${ui}/`)
const { ignorePatterns: _ignored, ...oxlintConfig } = JSON.parse(
  readFileSync(join(root, ".oxlintrc.json"), "utf8"),
)
writeFileSync(join(sandbox, ".oxlintrc.json"), inFixtureFolder(JSON.stringify(oxlintConfig)))
writeFileSync(
  join(sandbox, ".stylelintrc.json"),
  inFixtureFolder(readFileSync(join(root, ".stylelintrc.json"), "utf8")),
)

afterAll(() => rmSync(sandbox, { recursive: true, force: true }))

type Case = [file: string, what: string, source: string]
type Problem = { rule: string; line: number; message: string }

const writeFixtures = (cases: Case[]) =>
  cases.map(([file, , source], i) => {
    const path = join(sandbox, String(i), file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, source)
    return path
  })

const problems = new Map<string, Problem[]>()
const key = (file: string, what: string) => `${file}|${what}`

// One run per linter for every fixture: a run per case costs about a second under load.
const lintCss = async (cases: Case[]) => {
  const paths = writeFixtures(cases)
  const { results } = await stylelint.lint({
    files: paths,
    configFile: join(sandbox, ".stylelintrc.json"),
  })
  paths.forEach((path, i) => {
    const result = results.find((r) => r.source === path)
    problems.set(
      key(cases[i]![0], cases[i]![1]),
      (result?.warnings ?? []).map((w) => ({ rule: w.rule, line: w.line, message: w.text })),
    )
  })
}

type Diagnostic = {
  code: string
  message: string
  help?: string
  filename: string
  labels: { span: { line: number } }[]
}

const lintTsx = (cases: Case[]) => {
  const paths = writeFixtures(cases)
  const run = spawnSync(
    join(root, "node_modules/.bin/vp"),
    ["lint", "-c", join(sandbox, ".oxlintrc.json"), "-f", "json", ...paths],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  )
  const { diagnostics } = JSON.parse(run.stdout) as { diagnostics: Diagnostic[] }
  paths.forEach((path, i) => {
    problems.set(
      key(cases[i]![0], cases[i]![1]),
      diagnostics
        .filter((d) => d.filename === path && d.code.startsWith("react("))
        .map((d) => ({
          rule: d.code,
          line: d.labels[0]!.span.line,
          message: `${d.message} ${d.help ?? ""}`,
        })),
    )
  })
}

const problemsOf = (file: string, what: string) => problems.get(key(file, what))!

const hexColour: Case = [
  `${ui}/modules/session/ui/a.css`,
  "a hex colour",
  `.a {\n  color: #d97757;\n}\n`,
]

const cssForbidden: Case[] = [
  hexColour,
  [`${ui}/modules/session/ui/a.css`, "an upper-case RGB()", `.a {\n  color: RGB(0 0 0);\n}\n`],
  [`${ui}/modules/session/ui/a.css`, "device-cmyk()", `.a {\n  color: device-cmyk(0 0 0 1);\n}\n`],
  [`${ui}/modules/session/ui/a.css`, "an upper-case VAR()", `.a {\n  width: VAR(--width);\n}\n`],
  [`${ui}/modules/session/ui/a.css`, "a named colour", `.a {\n  color: red;\n}\n`],
  [`${ui}/modules/session/ui/a.css`, "rgb()", `.a {\n  color: rgb(0 0 0 / 50%);\n}\n`],
  [`${ui}/modules/session/ui/a.css`, "hsl()", `.a {\n  color: hsl(0 0% 0%);\n}\n`],
  [`${ui}/modules/session/ui/a.css`, "oklch()", `.a {\n  color: oklch(0.5 0.1 120);\n}\n`],
  [
    `${ui}/core/components/menu/menu.css`,
    "a hex colour inside color-mix()",
    `.a {\n  color: color-mix(in srgb, var(--iv-accent) 8%, #fff);\n}\n`,
  ],
  [
    `${ui}/core/components/menu/menu.css`,
    "a variable of its own",
    `.a {\n  width: var(--width);\n}\n`,
  ],
  [
    `${ui}/core/components/menu/menu.css`,
    "a variable named like a library one",
    `.a {\n  transform-origin: var(--transform-origin-x);\n}\n`,
  ],
  [
    `${ui}/core/components/menu/menu.css`,
    "a variable as the fallback of a token",
    `.a {\n  width: var(--iv-card-width, var(--width));\n}\n`,
  ],
  [
    `${ui}/core/theme/tokens.css`,
    "a variable of its own",
    `:root {\n  --iv-text: var(--text);\n}\n`,
  ],
]

const cssAllowed: Case[] = [
  [`${ui}/modules/session/ui/a.css`, "a token", `.a {\n  color: var(--iv-text);\n}\n`],
  [
    `${ui}/modules/session/ui/a.css`,
    "color-mix() on a token",
    `.a {\n  background: color-mix(in srgb, var(--iv-accent) 8%, transparent);\n}\n`,
  ],
  [`${ui}/modules/session/ui/a.css`, "transparent", `.a {\n  background: transparent;\n}\n`],
  [`${ui}/modules/session/ui/a.css`, "currentColor", `.a {\n  fill: currentColor;\n}\n`],
  [
    `${ui}/core/components/menu/menu.css`,
    "the variables the component library sets",
    `.a {\n  max-height: var(--available-height);\n  max-width: var(--available-width);\n  transform-origin: var(--transform-origin);\n}\n`,
  ],
  [
    `${ui}/app/app.css`,
    "the size a resize handle sets",
    `.a {\n  width: var(--iv-card-width, 280px);\n}\n`,
  ],
  [`${ui}/core/theme/tokens.css`, "a hex colour", `:root {\n  --iv-text: #1a1a1a;\n}\n`],
  [`${ui}/core/theme/tokens.css`, "oklch()", `:root {\n  --iv-accent: oklch(0.5 0.1 150);\n}\n`],
  [
    `${ui}/core/components/harness-mark/harness-mark.css`,
    "a brand colour",
    `.iv-harness-mark--claude {\n  color: #d97757;\n}\n`,
  ],
  [
    `${ui}/core/components/resize-handle/resize-handle.test.css`,
    "anything, as a test file",
    `.a {\n  width: var(--test-width, 200px);\n  color: red;\n}\n`,
  ],
]

const nativeButton: Case = [
  `${ui}/modules/session/ui/a.tsx`,
  "a native <button>",
  `export const A = () => (\n  <button type="button" />\n)\n`,
]

const tsxForbidden: Case[] = [
  [
    `${ui}/modules/session/ui/a.tsx`,
    "a style prop",
    `export const A = () => (\n  <div style={{ height: 300 }} />\n)\n`,
  ],
  [
    `${ui}/core/components/menu/menu.tsx`,
    "a style prop",
    `export const A = () => (\n  <div style={{ height: 300 }} />\n)\n`,
  ],
  nativeButton,
  [
    `${ui}/modules/session/ui/a.tsx`,
    "a native <input>",
    `export const A = () => (\n  <input />\n)\n`,
  ],
  [
    `${ui}/modules/session/ui/a.tsx`,
    "a native <select>",
    `export const A = () => (\n  <select />\n)\n`,
  ],
  [`${ui}/app/a.tsx`, "a native <textarea>", `export const A = () => (\n  <textarea />\n)\n`],
]

const tsxAllowed: Case[] = [
  [
    `${ui}/modules/session/ui/a.tsx`,
    "a className",
    `export const A = () => (\n  <div className="iv-a" />\n)\n`,
  ],
  [
    `${ui}/core/components/resize-handle/resize-handle.tsx`,
    "a style prop",
    `export const A = () => (\n  <div style={{ height: 300 }} />\n)\n`,
  ],
  [
    `${ui}/modules/transcript/ui/transcript-view.test.tsx`,
    "a style prop, as a test file",
    `export const A = () => (\n  <div style={{ height: 300 }} />\n)\n`,
  ],
  [
    `${ui}/core/components/button/button.tsx`,
    "a native <button>",
    `export const A = () => (\n  <button type="button" />\n)\n`,
  ],
  [
    `${ui}/modules/session/ui/a.test.tsx`,
    "a native <button>, as a test file",
    `export const A = () => (\n  <button type="button" />\n)\n`,
  ],
  ...[
    "project/ui/project-rail.tsx",
    "project/ui/project-select.tsx",
    "project/ui/project-strip.tsx",
    "session/ui/branch-picker.tsx",
    "session/ui/checkout-sync.tsx",
    "session/ui/draft-images.tsx",
    "session/ui/pick-working-folder.tsx",
    "session/ui/run-options-menu.tsx",
    "session/ui/working-folder-picker.tsx",
    "tab/ui/sub-view-card.tsx",
    "tab/ui/tab-bar.tsx",
    "transcript/ui/background-fold.tsx",
    "transcript/ui/image-marker.tsx",
    "transcript/ui/image-thumbnail.tsx",
    "transcript/ui/task-sheet.tsx",
    "transcript/ui/turn-work.tsx",
  ].map((file): Case => [
    `${ui}/modules/${file}`,
    "a native control, as a control no core component draws",
    `export const A = () => (\n  <button type="button"><input type="radio" /></button>\n)\n`,
  ]),
]

beforeAll(async () => {
  await lintCss([...cssForbidden, ...cssAllowed])
  lintTsx([...tsxForbidden, ...tsxAllowed])
}, 30_000)

describe("UI styles in CSS", () => {
  test.each(cssForbidden)("%s may not hold %s", (file, what) => {
    const found = problemsOf(file, what)
    expect(found).toHaveLength(1)
    expect(found[0]!.message).toMatch(/docs\/conventions\/ui\.md#(colour|styles)/)
    expect(found[0]!.message).toContain("--iv-")
  })

  test.each(cssAllowed)("%s may hold %s", (file, what) => {
    expect(problemsOf(file, what)).toEqual([])
  })

  test("a failure names the rule, the line and the token to use", () => {
    const [found] = problemsOf(hexColour[0], hexColour[1])
    expect(found).toEqual({
      rule: "color-no-hex",
      line: 2,
      message: expect.stringContaining(
        "use a --iv- colour token from core/theme/tokens.css, or color-mix() on one (docs/conventions/ui.md#colour)",
      ),
    })
  })
})

describe("UI styles in TSX", () => {
  test.each(tsxForbidden)("%s may not hold %s", (file, what) => {
    const found = problemsOf(file, what)
    expect(found).toHaveLength(1)
    expect(found[0]!.message).toContain("docs/conventions/ui.md#styles")
  })

  test.each(tsxAllowed)("%s may hold %s", (file, what) => {
    expect(problemsOf(file, what)).toEqual([])
  })

  test("a native control names the rule, the line and the component to use", () => {
    const [found] = problemsOf(nativeButton[0], nativeButton[1])
    expect(found).toEqual({
      rule: "react(forbid-elements)",
      line: 2,
      message: expect.stringContaining("use Button or IconButton from core/components/button"),
    })
  })
})
