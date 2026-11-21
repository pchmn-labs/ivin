import { expect, test } from "vitest"
import { languageNameOf } from "./language-name.ts"

test("a file's language comes from its extension, whatever its case, or from its whole name", () => {
  expect(languageNameOf("main.ts")).toBe("typescript")
  expect(languageNameOf("App.TSX")).toBe("tsx")
  expect(languageNameOf("ci.yml")).toBe("yaml")
  expect(languageNameOf("Dockerfile")).toBe("dockerfile")
})

test("a file with no known extension, or only a leading dot, has no language", () => {
  expect(languageNameOf("LICENSE")).toBeNull()
  expect(languageNameOf("notes.xyz")).toBeNull()
  expect(languageNameOf(".gitignore")).toBeNull()
})
