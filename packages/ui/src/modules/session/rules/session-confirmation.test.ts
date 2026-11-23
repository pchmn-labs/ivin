import { expect, test } from "vitest"
import { makeTestSession } from "../../../core/test-session.ts"
import { confirmationText, needsConfirmation } from "./session-confirmation.ts"

const session = makeTestSession({ id: "s1", title: "Fix it", status: "idle" })
const working = makeTestSession({ id: "s1", title: "Fix it", status: "working" })
const project = { path: "/p", name: "ivin" }

test("an archive asks only for a running agent or unsaved edits", () => {
  expect(needsConfirmation({ action: "archive", session, unsaved: [] })).toBe(false)
  expect(needsConfirmation({ action: "archive", session: working, unsaved: [] })).toBe(true)
  expect(needsConfirmation({ action: "archive", session, unsaved: ["a.md"] })).toBe(true)
})

test("a delete always asks, a project close only with unsaved edits", () => {
  expect(needsConfirmation({ action: "delete", session, unsaved: [] })).toBe(true)
  const none = [{ title: "A", unsaved: [] }]
  expect(needsConfirmation({ action: "closeProject", project, sessions: none })).toBe(false)
  const some = [{ title: "A", unsaved: ["a.md"] }]
  expect(needsConfirmation({ action: "closeProject", project, sessions: some })).toBe(true)
})

test("one dialog says the running agent and the unsaved files together", () => {
  expect(
    confirmationText({ action: "archive", session: working, unsaved: ["src/a.md", "b.md"] }),
  ).toEqual({
    title: "Archive “Fix it”?",
    description:
      "Archiving this session will stop the working agent and lose the unsaved edits to these files:",
    files: ["a.md", "b.md"],
    confirm: "Stop and archive",
  })
})

test("unsaved edits alone on an archive", () => {
  expect(confirmationText({ action: "archive", session, unsaved: ["src/a.md"] })).toEqual({
    title: "Archive “Fix it”?",
    description: "Archiving this session will lose the unsaved edits to these files:",
    files: ["a.md"],
    confirm: "Archive and lose edits",
  })
})

test("a running agent alone keeps the existing wording", () => {
  const text = confirmationText({ action: "archive", session: working, unsaved: [] })
  expect(text.title).toBe("Archive the session and stop its agent?")
  expect(text.confirm).toBe("Stop and archive")
  expect(text.files).toEqual([])
})

test("a delete words its sentence and button", () => {
  expect(confirmationText({ action: "delete", session, unsaved: [] })).toMatchObject({
    title: "Delete “Fix it”?",
    description: "The session and its transcript are erased. This cannot be undone.",
    confirm: "Delete session",
  })
  expect(confirmationText({ action: "delete", session: working, unsaved: ["a.md"] })).toMatchObject(
    {
      description:
        "Deleting this session will stop the working agent and lose the unsaved edits to these files:",
      files: ["a.md"],
      confirm: "Delete and lose edits",
    },
  )
})

test("a project close names the session of each file once several have edits", () => {
  const one = confirmationText({
    action: "closeProject",
    project,
    sessions: [
      { title: "A", unsaved: ["x/a.md"] },
      { title: "B", unsaved: [] },
    ],
  })
  expect(one.files).toEqual(["a.md"])
  expect(one.title).toBe("Close “ivin”?")
  expect(one.confirm).toBe("Close project and lose edits")
  const many = confirmationText({
    action: "closeProject",
    project,
    sessions: [
      { title: "A", unsaved: ["a.md"] },
      { title: "B", unsaved: ["b.md"] },
    ],
  })
  expect(many.files).toEqual(["a.md (A)", "b.md (B)"])
})
