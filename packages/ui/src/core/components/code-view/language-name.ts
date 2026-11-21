export type LanguageName =
  | "typescript"
  | "tsx"
  | "javascript"
  | "jsx"
  | "json"
  | "css"
  | "html"
  | "markdown"
  | "yaml"
  | "python"
  | "rust"
  | "go"
  | "shell"
  | "toml"
  | "dockerfile"

const BY_EXTENSION: Record<string, LanguageName> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  json: "json",
  jsonc: "json",
  css: "css",
  html: "html",
  htm: "html",
  md: "markdown",
  markdown: "markdown",
  yml: "yaml",
  yaml: "yaml",
  py: "python",
  rs: "rust",
  go: "go",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  toml: "toml",
}

const BY_NAME: Record<string, LanguageName> = {
  Dockerfile: "dockerfile",
  ".zshrc": "shell",
  ".bashrc": "shell",
}

export const languageNameOf = (fileName: string): LanguageName | null => {
  const named = BY_NAME[fileName]
  if (named !== undefined) return named
  const dot = fileName.lastIndexOf(".")
  return dot <= 0 ? null : (BY_EXTENSION[fileName.slice(dot + 1).toLowerCase()] ?? null)
}
