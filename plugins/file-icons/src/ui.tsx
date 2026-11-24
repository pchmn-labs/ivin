import { defineUi, type FileIconRow } from "@ivin/plugin-api/ui"
import { iconPathOf, indexTheme, type IconTheme, type ThemeIndex } from "./rules/icon-theme.ts"
import { languageOfExtension } from "./rules/languages.ts"

function ThemeIcon({ dark, light }: { dark: string; light: string }) {
  if (light === dark) return <img src={dark} alt="" decoding="async" />
  return (
    <picture>
      <source srcSet={light} media="(prefers-color-scheme: light)" />
      <img src={dark} alt="" decoding="async" />
    </picture>
  )
}

const iconFor = (index: ThemeIndex, url: (path: string) => string) => (row: FileIconRow) => {
  const dark = iconPathOf(index, row, false)
  if (dark === null) return null
  return <ThemeIcon dark={url(dark)} light={url(iconPathOf(index, row, true) ?? dark)} />
}

export const activate = defineUi((ctx) => {
  // A chunk of its own: the theme file weighs about 450 KB.
  void import("../theme/material-icons.json").then(
    ({ default: theme }) =>
      ctx.fileIcons.add(iconFor(indexTheme(theme as IconTheme, languageOfExtension), ctx.fileUrl)),
    (error: unknown) => console.error("file-icons could not load its theme", error),
  )
})
