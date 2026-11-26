// Where the app's types for a plugin sit: each key of tsconfig `paths` with its targets.
export type TypePaths = Readonly<Record<string, ReadonlyArray<string>>>

export const pluginTemplate = (id: string, paths: TypePaths): Record<string, string> => ({
  "package.json": `${JSON.stringify(
    {
      name: `ivin-plugin-${id}`,
      version: "0.1.0",
      private: true,
      type: "module",
      peerDependencies: { "@ivin/plugin-api": "^0" },
      ivin: { id, name: id, server: "src/server.ts", ui: "src/ui.tsx" },
    },
    null,
    2,
  )}\n`,
  "tsconfig.json": `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2023",
        lib: ["ES2023", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        allowImportingTsExtensions: true,
        types: [],
        paths,
      },
      include: ["src"],
    },
    null,
    2,
  )}\n`,
  "README.md": `# ${id}

A plugin for ivin. \`package.json\` holds its manifest under the \`ivin\` key.

- \`src/ui.tsx\` runs in the window: it adds a line to the bottom of the sidebar.
- \`src/server.ts\` runs in the plugin host: it logs when it starts and stops.

Edit a file and ivin reloads the plugin. \`ivin plugin check ${id}\` type-checks it, and \`ivin plugin logs ${id}\` prints what it logged.
`,
  "src/ui.tsx": `import { defineUi } from "@ivin/plugin-api/ui"

function Hello() {
  return <div style={{ padding: 8 }}>The ${id} plugin is running.</div>
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("sidebar.bottom", Hello)
})
`,
  "src/server.ts": `import { defineServer } from "@ivin/plugin-api/server"

export const activate = defineServer((ctx) => {
  console.log("${id}: server half started")
  ctx.signal.addEventListener("abort", () => console.log("${id}: server half stopped"))
})
`,
})
