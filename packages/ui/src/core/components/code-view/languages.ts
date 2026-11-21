import { StreamLanguage, type StreamParser } from "@codemirror/language"
import type { Extension } from "@codemirror/state"
import type { LanguageName } from "./language-name.ts"

const legacy = async (mode: Promise<StreamParser<unknown>>) => StreamLanguage.define(await mode)

// Each package is imported only when a file of its language opens, so the others are never parsed.
export const loadLanguage: Record<LanguageName, () => Promise<Extension>> = {
  typescript: () =>
    import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  tsx: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ typescript: true, jsx: true }),
    ),
  javascript: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  jsx: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true })),
  json: () => import("@codemirror/lang-json").then((m) => m.json()),
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  yaml: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
  python: () => import("@codemirror/lang-python").then((m) => m.python()),
  rust: () => import("@codemirror/lang-rust").then((m) => m.rust()),
  go: () => import("@codemirror/lang-go").then((m) => m.go()),
  shell: () => legacy(import("@codemirror/legacy-modes/mode/shell").then((m) => m.shell)),
  toml: () => legacy(import("@codemirror/legacy-modes/mode/toml").then((m) => m.toml)),
  dockerfile: () =>
    legacy(import("@codemirror/legacy-modes/mode/dockerfile").then((m) => m.dockerFile)),
}
