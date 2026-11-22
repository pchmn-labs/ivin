# file-icons

Gives each row of the Files tab's tree its icon from a VS Code file icon theme, through `ctx.fileIcons`: Material Icon Theme 5.40.0 (MIT, see `theme/LICENSE` and the repo's `NOTICE`), copied unchanged from the `material-icon-theme` npm package: `dist/material-icons.json` as `theme/material-icons.json`, and `icons/`.

The theme file loads in a chunk of its own once the plugin is active, and is indexed once (`src/rules/icon-theme.ts`); until then the rows keep the `Tree`'s own icons. A row's icon is looked up as VS Code does: the file's name, its longest matching extension (`.test.ts` before `.ts`), the language of its extension (`src/rules/languages.ts`, VS Code's built-in languages), then the theme's file icon; a folder by its name, open or closed, then the theme's folder icons. Under a light system appearance the theme's `light` entries win at each step. Each icon is an `<img>` of `ctx.fileUrl`, which the desktop app serves from this folder, so an SVG loads only when its row is shown. The theme's `hidesExplorerArrows` is ignored.

To update the theme, replace `icons/` and `theme/material-icons.json` from the new package, and its version here and in `NOTICE`.
