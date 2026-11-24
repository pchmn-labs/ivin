import { expect, test } from "vitest"
import { showInFolderLabel } from "./show-in-folder.ts"

test("the button that shows a file in the file manager is named for the platform", () => {
  expect(showInFolderLabel("darwin")).toBe("Show in Finder")
  expect(showInFolderLabel("win32")).toBe("Show in File Explorer")
  expect(showInFolderLabel("linux")).toBe("Show in Folder")
})
