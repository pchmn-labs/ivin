import { expect, test, vi } from "vitest"
import { userEvent } from "vitest/browser"
import {
  addSession,
  draftThumbnails,
  field,
  mount,
  paste,
  PIXEL,
  png,
  view,
} from "./test-composer.tsx"

const reads: Array<{ resolve: (base64: string) => void }> = []
vi.mock("../adapters/read-image-file.ts", () => ({
  readImageFile: () => new Promise<string>((resolve) => reads.push({ resolve })),
}))

test("two images pasted before either is read take the numbers #1 and #2", async () => {
  reads.length = 0
  await mount()
  await field().click()
  paste([png("a.png")])
  paste([png("b.png")])
  await vi.waitFor(() => expect(reads.length).toBe(2))
  for (const read of reads) read.resolve(PIXEL)

  await expect.element(field().getByRole("img", { name: "Image #1" })).toBeVisible()
  await expect.element(field().getByRole("img", { name: "Image #2" })).toBeVisible()
})

test("an image that finishes reading after its tab was left is in the field, marker at the end, when the user comes back", async () => {
  reads.length = 0
  const { server, screen } = await mount()
  await field().click()
  await userEvent.keyboard("look")
  paste([png("a.png")])
  await vi.waitFor(() => expect(reads.length).toBe(1))
  addSession(server, "s2")
  await screen.rerender(view(server, "s2"))
  reads[0]?.resolve(PIXEL)
  await screen.rerender(view(server, "s1"))

  await expect.element(draftThumbnails()).toHaveAccessibleName("View image #1")
  await expect.element(field().getByRole("img", { name: "Image #1" })).toBeVisible()
  await expect.element(field()).toHaveTextContent("look #1")
})
