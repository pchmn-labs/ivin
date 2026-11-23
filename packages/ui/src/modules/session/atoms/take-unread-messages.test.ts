import { afterEach, expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { draftOf } from "./draft.ts"
import { takeUnreadMessagesAtom } from "./take-unread-messages.ts"

const unread = [
  {
    id: "m1",
    text: "look [Image #1] and [Image #2]",
    images: [
      { id: "a", number: 1, mediaType: "image/png" as const },
      { id: "b", number: 2, mediaType: "image/png" as const },
    ],
  },
]

const setup = () => {
  const fetched: Array<string> = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      fetched.push(url)
      return new Response(new Uint8Array([104, 105]))
    }),
  )
  const { registry } = makeTestRegistry()
  registry.mount(takeUnreadMessagesAtom)
  registry.mount(draftOf("s1"))
  return { registry, fetched }
}

afterEach(() => vi.unstubAllGlobals())

test("unread messages come into the draft once, with their images read from where the transcript serves them", async () => {
  const { registry, fetched } = setup()

  registry.set(takeUnreadMessagesAtom, { sessionId: "s1", lastImageNumber: 4, messages: unread })
  registry.set(takeUnreadMessagesAtom, { sessionId: "s1", lastImageNumber: 4, messages: unread })

  await vi.waitFor(() => expect(registry.get(draftOf("s1")).images).toHaveLength(2))
  expect(registry.get(draftOf("s1")).text).toBe("look [Image #5] and [Image #6]")
  expect(registry.get(draftOf("s1")).images.map((i) => [i.number, i.base64])).toEqual([
    [5, "aGk="],
    [6, "aGk="],
  ])
  expect(fetched).toEqual(["ivin-image://s1/a.png", "ivin-image://s1/b.png"])
})

test("text the user removed stays removed when the composer asks again", async () => {
  const { registry } = setup()
  registry.set(takeUnreadMessagesAtom, { sessionId: "s1", lastImageNumber: 0, messages: unread })
  await vi.waitFor(() => expect(registry.get(draftOf("s1")).images).toHaveLength(2))

  registry.set(draftOf("s1"), { text: "", images: [] })
  registry.set(takeUnreadMessagesAtom, { sessionId: "s1", lastImageNumber: 0, messages: unread })
  registry.set(takeUnreadMessagesAtom, { sessionId: "s1", lastImageNumber: 0, messages: unread })

  expect(registry.get(draftOf("s1"))).toEqual({ text: "", images: [] })
})

test("once the server cleared the unread messages, new ones come in again", async () => {
  const { registry } = setup()
  registry.set(takeUnreadMessagesAtom, { sessionId: "s1", lastImageNumber: 0, messages: unread })
  await vi.waitFor(() => expect(registry.get(draftOf("s1")).images).toHaveLength(2))

  registry.set(takeUnreadMessagesAtom, { sessionId: "s1", lastImageNumber: 2, messages: [] })
  registry.set(draftOf("s1"), { text: "", images: [] })
  const later = [{ id: "m2", text: "later", images: [] }]
  registry.set(takeUnreadMessagesAtom, { sessionId: "s1", lastImageNumber: 2, messages: later })

  await vi.waitFor(() => expect(registry.get(draftOf("s1")).text).toBe("later"))
})

test("an image that cannot be read leaves the text without its marker", async () => {
  const { registry } = setup()
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  )

  registry.set(takeUnreadMessagesAtom, { sessionId: "s1", lastImageNumber: 0, messages: unread })

  await vi.waitFor(() => expect(registry.get(draftOf("s1")).text).toBe("look  and "))
  expect(registry.get(draftOf("s1")).images).toEqual([])
})
