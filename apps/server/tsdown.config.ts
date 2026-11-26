import { readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import type { PackUserConfig } from "vite-plus/pack"

const pnpmFolder = dirname(createRequire(import.meta.url).resolve("pnpm"))

// Rolldown's native binding for this machine, which the server bundle cannot hold.
const platformTag =
  process.platform === "linux" ? `linux-${process.arch}-gnu` : `${process.platform}-${process.arch}`
const fromRolldown = createRequire(createRequire(import.meta.url).resolve("rolldown"))
const rolldownBinding = join(
  dirname(fromRolldown.resolve(`@rolldown/binding-${platformTag}/package.json`)),
  `rolldown-binding.${platformTag}.node`,
)

// The TypeScript compiler `ivin plugin check` runs, and the default libraries it reads beside it.
const typescriptFolder = dirname(createRequire(import.meta.url).resolve("typescript-compiler-api"))
const typescriptLibraries = readdirSync(typescriptFolder)
  .filter((name) => /^lib\..*\.d\.ts$/.test(name))
  .map((name) => join(typescriptFolder, name))

// The types a plugin sees: the plugin API's sources and every package they import, each in a folder of its own.
const apiFolder = dirname(createRequire(import.meta.url).resolve("@ivin/plugin-api/server"))
const fromApi = createRequire(join(apiFolder, "x.ts"))
const typePackages = [
  "@types/react",
  "@types/react-dom",
  "csstype",
  "@codemirror/state",
  "@codemirror/view",
  "@marijn/find-cluster-break",
  "crelt",
  "style-mod",
  "w3c-keyname",
]
// Some packages hide their package.json behind `exports`: walk up from their entry instead.
const packageFolder = (from: NodeJS.Require, name: string) => {
  try {
    return dirname(from.resolve(`${name}/package.json`))
  } catch {
    let folder = dirname(from.resolve(name))
    while (!folder.endsWith(join("node_modules", name))) folder = dirname(folder)
    return folder
  }
}
const typePackageCopies = typePackages.map((name) => {
  const folder = packageFolder(
    name === "@types/react-dom" ? createRequire(import.meta.url) : fromApi,
    name,
  )
  const scope = name.includes("/") ? `/${name.split("/")[0]}` : ""
  return { from: folder, to: `dist/plugin-types/node_modules${scope}` }
})

const server = {
  entry: {
    main: "src/main.ts",
    "webp-worker": "src/modules/transcript/adapters/webp-worker.ts",
    "ts-check-worker": "src/modules/plugin/adapters/ts-check-worker.ts",
  },
  format: "esm",
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  fixedExtension: false,
  deps: {
    alwaysBundle: [
      /^effect/,
      /^@ivin\//,
      /^@jsquash\//,
      /^jsonc-parser/,
      /^rolldown/,
      /^@rolldown\/pluginutils/,
      /^@oxc-project\//,
    ],
    neverBundle: [/^@rolldown\/binding-/],
    onlyBundle: false,
  },
  // `webp-codec.ts` reads these from `dist/wasm`, `fs-user-plugins.ts` the binding from `dist/native`, the desktop app pnpm from `dist/pnpm`, `plugin-types.ts` the compiler and the plugin types from `dist/typescript` and `dist/plugin-types`.
  copy: [
    { from: rolldownBinding, to: "dist/native", rename: "rolldown-binding.node" },
    { from: pnpmFolder, to: "dist" },
    // `.cjs`, because the server's package is an ES module package and the compiler is CommonJS.
    {
      from: join(typescriptFolder, "typescript.js"),
      to: "dist/typescript",
      rename: "typescript.cjs",
    },
    { from: typescriptLibraries, to: "dist/typescript", flatten: true },
    {
      from: readdirSync(apiFolder)
        .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
        .map((name) => join(apiFolder, name)),
      to: "dist/plugin-types/plugin-api/src",
      flatten: true,
    },
    ...typePackageCopies,
    {
      from: [
        "node_modules/@jsquash/png/codec/pkg/squoosh_png_bg.wasm",
        "node_modules/@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm",
        "node_modules/@jsquash/webp/codec/enc/webp_enc_simd.wasm",
      ],
      to: "dist/wasm",
      flatten: true,
    },
  ],
} satisfies PackUserConfig

// Alone in its build, so the file shares no chunk with the server and can sit outside the asar.
const pluginHost = {
  entry: { "plugin-host": "src/plugin-host.ts" },
  format: "esm",
  platform: "node",
  target: "node22",
  outDir: "dist",
  fixedExtension: false,
  deps: { alwaysBundle: [/^effect/, /^@ivin\//], onlyBundle: false },
} satisfies PackUserConfig

export default [server, pluginHost] satisfies PackUserConfig[]
