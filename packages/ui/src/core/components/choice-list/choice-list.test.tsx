import { useState } from "react"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { ChoiceList } from "./choice-list.tsx"

const OPTIONS = [
  { id: "vitest", label: "Vitest", description: "Already set up." },
  { id: "node", label: "Node's test runner" },
]

const mount = async ({ multiple = false }: { multiple?: boolean } = {}) => {
  const onSubmit = vi.fn()
  const onEscape = vi.fn()
  const onPrevious = vi.fn()
  const onNext = vi.fn()
  const Harness = () => {
    const [selected, setSelected] = useState<ReadonlyArray<string>>([])
    const [text, setText] = useState("")
    return (
      <>
        <textarea aria-label="Composer" />
        <ChoiceList
          label="Runner"
          multiple={multiple}
          options={OPTIONS}
          selected={selected}
          onSelectedChange={setSelected}
          onSubmit={onSubmit}
          onEscape={onEscape}
          onPrevious={onPrevious}
          onNext={onNext}
          other={{
            id: "other",
            label: "Other",
            placeholder: "Type your own answer",
            text,
            onTextChange: setText,
          }}
          keyboardSource={(target) => target instanceof HTMLTextAreaElement && target.value === ""}
          autoFocus
        />
      </>
    )
  }
  await render(<Harness />)
  return { onSubmit, onEscape, onPrevious, onNext }
}

const radio = (name: string | RegExp) => page.getByRole("radio", { name })
const checkbox = (name: string | RegExp) => page.getByRole("checkbox", { name })

test("a single choice is a radio group, each option with its description and its number", async () => {
  await mount()
  await expect.element(page.getByRole("radiogroup", { name: "Runner" })).toBeVisible()
  await expect.element(radio(/^Vitest/)).not.toBeChecked()
  await expect.element(page.getByText("Already set up.")).toBeVisible()
  await expect.element(radio(/^Other/)).toHaveTextContent("OtherType your own answer3")
  await expect.element(radio(/^Node's test runner/)).toHaveTextContent("Node's test runner2")
})

test("Space selects the option under the cursor without submitting, Enter submits it", async () => {
  const { onSubmit } = await mount()
  await expect.element(radio(/^Vitest/)).toHaveFocus()
  await userEvent.keyboard("{ArrowDown} ")
  await expect.element(radio(/^Node's/)).toBeChecked()
  expect(onSubmit).not.toHaveBeenCalled()
  await userEvent.keyboard("{ArrowUp}{Enter}")
  await expect.element(radio(/^Vitest/)).toBeChecked()
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith(["vitest"])
})

test("a number picks and submits a single choice", async () => {
  const { onSubmit } = await mount()
  await userEvent.keyboard("2")
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith(["node"])
})

test("several answers are check boxes that Space and numbers tick, and Enter submits them all", async () => {
  const { onSubmit } = await mount({ multiple: true })
  await expect.element(page.getByRole("group", { name: "Runner" })).toBeVisible()
  await userEvent.keyboard(" 2")
  await expect.element(checkbox(/^Vitest/)).toBeChecked()
  await expect.element(checkbox(/^Node's/)).toBeChecked()
  await userEvent.keyboard("1")
  await expect.element(checkbox(/^Vitest/)).not.toBeChecked()
  expect(onSubmit).not.toHaveBeenCalled()
  await userEvent.keyboard("{Enter}")
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith(["node"])
})

test("Other opens a field whose text, confirmed with Enter, is the answer", async () => {
  const { onSubmit } = await mount()
  await userEvent.keyboard("3")
  await expect.element(page.getByRole("textbox", { name: "Other" })).toHaveFocus()
  await userEvent.keyboard("Jest, please{Enter}")
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith(["other"])
  await expect.element(radio(/^Other/)).toBeChecked()
})

test("Escape in the Other field closes it without escaping the list", async () => {
  const { onEscape } = await mount()
  await userEvent.keyboard("3")
  await userEvent.keyboard("{Escape}")
  await expect.element(page.getByRole("textbox", { name: "Other" })).not.toBeInTheDocument()
  await expect.element(radio(/^Other/)).not.toBeChecked()
  expect(onEscape).not.toHaveBeenCalled()
  await userEvent.keyboard("{Escape}")
  expect(onEscape).toHaveBeenCalledOnce()
})

test("left and right ask for the previous and the next list", async () => {
  const { onPrevious, onNext } = await mount()
  await userEvent.keyboard("{ArrowLeft}{ArrowRight}")
  expect(onPrevious).toHaveBeenCalledOnce()
  expect(onNext).toHaveBeenCalledOnce()
})

test("from the empty composer the arrows and Enter drive the list, but numbers and Space stay text", async () => {
  const { onSubmit } = await mount()
  const composer = page.getByRole("textbox", { name: "Composer" })
  await userEvent.click(composer)
  await userEvent.keyboard("{ArrowDown}{Enter}")
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith(["node"])
  await userEvent.keyboard("1")
  await expect.element(composer).toHaveValue("1")
})

test("on mount the list takes the focus from the empty composer, but not from a draft", async () => {
  const Harness = ({ draft }: { draft: string }) => {
    const [shown, setShown] = useState(false)
    return (
      <>
        <textarea aria-label="Composer" defaultValue={draft} autoFocus />
        <button type="button" onClick={() => setShown(true)}>
          Show
        </button>
        {shown ? (
          <ChoiceList
            label="Runner"
            options={OPTIONS}
            selected={[]}
            onSelectedChange={() => undefined}
            onSubmit={() => undefined}
            keyboardSource={(target) =>
              target instanceof HTMLTextAreaElement && target.value === ""
            }
            autoFocus
          />
        ) : null}
      </>
    )
  }
  const first = await render(<Harness draft="" />)
  page.getByRole("textbox", { name: "Composer" }).element().focus()
  ;(page.getByRole("button", { name: "Show" }).element() as HTMLButtonElement).click()
  await expect.element(radio(/^Vitest/)).toHaveFocus()
  await first.unmount()

  await render(<Harness draft="half a thought" />)
  page.getByRole("textbox", { name: "Composer" }).element().focus()
  ;(page.getByRole("button", { name: "Show" }).element() as HTMLButtonElement).click()
  await expect.element(radio(/^Vitest/)).toBeVisible()
  await expect.element(page.getByRole("textbox", { name: "Composer" })).toHaveFocus()
})
