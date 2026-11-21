import { expect, test } from "vitest"
import { editSettingsText } from "./edit-settings-text.ts"

test("an edit changes only the value at the path, keeping comments, key order and indentation", () => {
  const text = `{
    // Keep agents running when a tab closes.
    "worktrees": { "removeOnTabClose": true }, /* trailing */
    "tabs": {
        "stopAgentOnClose": true, // the one to change
    },
}
`
  expect(editSettingsText(text, "tabs.stopAgentOnClose", false)).toEqual({
    ok: true,
    text: text.replace('"stopAgentOnClose": true', '"stopAgentOnClose": false'),
  })
})

test("a setting missing from the file is added with the file's own indentation", () => {
  const text = `{
\t// mine
\t"tabs": { "stopAgentOnClose": false }
}
`
  expect(editSettingsText(text, "worktrees.removeOnTabClose", false)).toEqual({
    ok: true,
    text: `{
\t// mine
\t"tabs": { "stopAgentOnClose": false },
\t"worktrees": {
\t\t"removeOnTabClose": false
\t}
}
`,
  })
})

test("a missing or empty file becomes one holding only that value", () => {
  const only = `{
  "tabs": {
    "stopAgentOnClose": false
  }
}
`
  expect(editSettingsText(null, "tabs.stopAgentOnClose", false)).toEqual({ ok: true, text: only })
  expect(editSettingsText(" \n", "tabs.stopAgentOnClose", false)).toEqual({ ok: true, text: only })
})

test("a section that is not an object is replaced by one holding the value", () => {
  expect(editSettingsText(`{ "tabs": 1 }`, "tabs.stopAgentOnClose", false)).toEqual({
    ok: true,
    text: `{ "tabs": {
    "stopAgentOnClose": false
  } }`,
  })
})

test("a file that is not JSON is refused with its first parse error", () => {
  expect(
    editSettingsText(`{\n  "tabs": {}\n  "worktrees": {}\n}`, "tabs.stopAgentOnClose", false),
  ).toEqual({
    ok: false,
    reason: "notJson",
    parseError: { code: "CommaExpected", line: 3, column: 3 },
  })
})

test("a file that holds no object is refused", () => {
  expect(editSettingsText(`[]`, "tabs.stopAgentOnClose", false)).toEqual({
    ok: false,
    reason: "notAnObject",
    parseError: null,
  })
})
