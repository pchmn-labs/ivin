import { useState } from "react"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { OptionList } from "./option-list.tsx"

const OPTIONS = [
  { id: "allow", label: "Allow" },
  { id: "deny", label: "Deny", hint: "Esc" },
]

const mount = async ({
  disabled = false,
  submitOnClick = false,
}: { disabled?: boolean; submitOnClick?: boolean } = {}) => {
  const onSubmit = vi.fn()
  const onEscape = vi.fn()
  const Harness = () => {
    const [value, setValue] = useState("allow")
    return (
      <>
        <textarea aria-label="Outside" />
        <OptionList
          label="Answer"
          options={OPTIONS}
          value={value}
          onChange={setValue}
          onSubmit={onSubmit}
          onEscape={onEscape}
          disabled={disabled}
          submitOnClick={submitOnClick}
          keyboardSource={(target) => target instanceof HTMLTextAreaElement && target.value === ""}
        />
      </>
    )
  }
  await render(<Harness />)
  return { onSubmit, onEscape }
}

const radio = (name: string | RegExp) => page.getByRole("radio", { name })

test("the options are a radio group with the value checked and the hint shown", async () => {
  await mount()
  await expect.element(page.getByRole("radiogroup", { name: "Answer" })).toBeVisible()
  await expect.element(radio("Allow")).toBeChecked()
  await expect.element(radio(/^Deny/)).not.toBeChecked()
  await expect.element(page.getByText("Esc")).toBeVisible()
})

test("the arrows move the choice and the focus, Enter submits it, Escape escapes", async () => {
  const { onSubmit, onEscape } = await mount()
  radio("Allow").element().focus()
  await userEvent.keyboard("{ArrowDown}")
  await expect.element(radio(/^Deny/)).toBeChecked()
  await expect.element(radio(/^Deny/)).toHaveFocus()
  await userEvent.keyboard("{ArrowDown}")
  await expect.element(radio(/^Deny/)).toBeChecked()
  await userEvent.keyboard("{Enter}")
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith("deny")
  await userEvent.keyboard("{Escape}")
  expect(onEscape).toHaveBeenCalledOnce()
})

test("the keyboard source, here the empty textarea, drives the list without taking the focus", async () => {
  const { onSubmit, onEscape } = await mount()
  const outside = page.getByRole("textbox", { name: "Outside" })
  await outside.click()
  await userEvent.keyboard("{ArrowDown}")
  await expect.element(radio(/^Deny/)).toBeChecked()
  await expect.element(outside).toHaveFocus()
  await userEvent.keyboard("{Enter}")
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith("deny")
  await userEvent.keyboard("{Escape}")
  expect(onEscape).toHaveBeenCalledOnce()
})

test("keys from anywhere else, body and a filled textarea included, do nothing", async () => {
  const { onSubmit, onEscape } = await mount()
  ;(document.activeElement as HTMLElement | null)?.blur()
  await userEvent.keyboard("{ArrowDown}{Enter}{Escape}")
  await page.getByRole("textbox", { name: "Outside" }).fill("text")
  await userEvent.keyboard("{ArrowDown}{Enter}{Escape}")
  await expect.element(radio("Allow")).toBeChecked()
  expect(onSubmit).not.toHaveBeenCalled()
  expect(onEscape).not.toHaveBeenCalled()
})

test("a disabled list ignores the keys", async () => {
  const { onSubmit } = await mount({ disabled: true })
  await page.getByRole("textbox", { name: "Outside" }).click()
  await userEvent.keyboard("{Enter}")
  expect(onSubmit).not.toHaveBeenCalled()
})

test("a click only chooses, unless submitOnClick is set", async () => {
  const first = await mount()
  await radio(/^Deny/).click()
  await expect.element(radio(/^Deny/)).toBeChecked()
  expect(first.onSubmit).not.toHaveBeenCalled()
})

test("with submitOnClick a click submits that option", async () => {
  const { onSubmit } = await mount({ submitOnClick: true })
  await radio(/^Deny/).click()
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith("deny")
})
