import { expect, test } from "vitest"
import type { Session } from "@ivin/contracts/session"
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
    lists: [{ label: null, items: ["a.md", "b.md"], files: true }],
    confirm: "Stop and archive",
  })
})

test("unsaved edits alone on an archive", () => {
  expect(confirmationText({ action: "archive", session, unsaved: ["src/a.md"] })).toEqual({
    title: "Archive “Fix it”?",
    description: "Archiving this session will lose the unsaved edits to these files:",
    lists: [{ label: null, items: ["a.md"], files: true }],
    confirm: "Archive and lose edits",
  })
})

test("a running agent alone keeps the existing wording", () => {
  const text = confirmationText({ action: "archive", session: working, unsaved: [] })
  expect(text.title).toBe("Archive the session and stop its agent?")
  expect(text.confirm).toBe("Stop and archive")
  expect(text.lists).toEqual([])
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
      lists: [{ label: null, items: ["a.md"], files: true }],
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
  expect(one.lists).toEqual([{ label: null, items: ["a.md"], files: true }])
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
  expect(many.lists[0]?.items).toEqual(["a.md (A)", "b.md (B)"])
})

const inactive = (
  title: string,
  status: Session["status"],
  unsaved: ReadonlyArray<string> = [],
) => ({
  session: makeTestSession({ id: title, title, status }),
  unsaved,
})

test("archiving or deleting all inactive sessions always asks", () => {
  const sessions = [inactive("A", "idle")]
  expect(needsConfirmation({ action: "archiveAll", sessions })).toBe(true)
  expect(needsConfirmation({ action: "deleteAll", sessions })).toBe(true)
})

test("archiving all idle sessions with no edits says they can be restored", () => {
  expect(
    confirmationText({
      action: "archiveAll",
      sessions: [inactive("A", "idle"), inactive("B", "failed")],
    }),
  ).toEqual({
    title: "Archive 2 inactive sessions?",
    description: "You can restore them from Archived sessions.",
    lists: [],
    confirm: "Archive all",
  })
})

test("archiving all lists the sessions whose agent stops, then the files whose edits are lost", () => {
  const text = confirmationText({
    action: "archiveAll",
    sessions: [
      inactive("A", "working"),
      inactive("B", "in_background", ["src/b.md"]),
      inactive("C", "idle", ["c.md"]),
      inactive("D", "idle"),
    ],
  })
  expect(text.lists).toEqual([
    { label: "These agents are still running and stop:", items: ["A", "B"], files: false },
    {
      label: "The unsaved edits to these files are lost:",
      items: ["b.md (B)", "c.md (C)"],
      files: true,
    },
  ])
  expect(text.confirm).toBe("Archive all and lose edits")
  expect(
    confirmationText({
      action: "archiveAll",
      sessions: [inactive("A", "waiting"), inactive("B", "idle")],
    }).confirm,
  ).toBe("Stop and archive all")
})

test("deleting all cannot be undone, and lists only the sessions whose agent stops", () => {
  const text = confirmationText({
    action: "deleteAll",
    sessions: [inactive("A", "working"), inactive("B", "idle", ["b.md"])],
  })
  expect(text).toEqual({
    title: "Delete 2 inactive sessions?",
    description: "The sessions and their transcripts are erased. This cannot be undone.",
    lists: [
      { label: "This agent is still running and stops:", items: ["A"], files: false },
      { label: "The unsaved edits to these files are lost:", items: ["b.md"], files: true },
    ],
    confirm: "Delete all and lose edits",
  })
  expect(
    confirmationText({ action: "deleteAll", sessions: [inactive("A", "working")] }).confirm,
  ).toBe("Delete all")
})

test("one inactive session is named in the singular", () => {
  expect(
    confirmationText({ action: "archiveAll", sessions: [inactive("A", "idle")] }),
  ).toMatchObject({
    title: "Archive 1 inactive session?",
    description: "You can restore it from Archived sessions.",
  })
  expect(
    confirmationText({ action: "deleteAll", sessions: [inactive("A", "idle")] }),
  ).toMatchObject({
    title: "Delete 1 inactive session?",
    description: "The session and its transcript are erased. This cannot be undone.",
  })
})
