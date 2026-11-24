import { bumpLevel } from "./tools/release/release.ts"

export default {
  git: {
    commitMessage: "chore(release): v${version}",
    tagName: "v${version}",
    requireCleanWorkingDir: true,
    push: false,
  },
  github: { release: false },
  npm: { publish: false },
  hooks: {
    "after:bump": "node tools/release/main.ts sync-version ${version}",
  },
  plugins: {
    "@release-it/conventional-changelog": {
      preset: { name: "conventionalcommits" },
      infile: "CHANGELOG.md",
      whatBump: (commits) => {
        const level = bumpLevel(commits.map((commit) => commit.header ?? ""))
        return level === "none" ? undefined : { level: level === "minor" ? 1 : 2 }
      },
    },
  },
}
