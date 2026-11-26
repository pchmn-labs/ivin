import { afterEach, expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { NotificationProvider, NotificationViewport } from "./notification.tsx"
import { notificationManager, notify, SHOWN_FOR } from "./notification-manager.ts"

afterEach(() => {
  notificationManager.close()
  vi.useRealTimers()
})

const shown = (text: string) => page.getByRole("region", { name: "Notifications" }).getByText(text)

async function mount() {
  await render(
    <NotificationProvider>
      <NotificationViewport />
    </NotificationProvider>,
  )
  await expect.element(page.getByRole("region", { name: "Notifications" })).toBeInTheDocument()
  // A notify before the provider's passive subscribe effect runs is lost; this message queues behind it.
  await new Promise<void>((resolve) => {
    const { port1, port2 } = new MessageChannel()
    port1.onmessage = () => resolve()
    port2.postMessage(null)
  })
}

test("a notification shows its message and goes away on its own", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  await mount()
  notify({ message: "The session was not archived." })
  await expect.element(shown("The session was not archived.")).toBeVisible()

  await vi.advanceTimersByTimeAsync(SHOWN_FOR + 1000)
  await expect.element(shown("The session was not archived.")).not.toBeInTheDocument()
})

test("a notification stays while the pointer is on it", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  await mount()
  notify({ message: "The message was not sent." })
  const message = shown("The message was not sent.")
  await expect.element(message).toBeVisible()

  await message.hover()
  await vi.advanceTimersByTimeAsync(SHOWN_FOR * 3)
  await expect.element(message).toBeVisible()

  await userEvent.unhover(message)
  await vi.advanceTimersByTimeAsync(SHOWN_FOR + 1000)
  await expect.element(message).not.toBeInTheDocument()
})

test("the keyboard closes a notification", async () => {
  await mount()
  notify({ message: "Could not switch branch." })
  await expect.element(shown("Could not switch branch.")).toBeVisible()

  await userEvent.keyboard("{F6}")
  await userEvent.tab()
  await userEvent.tab()
  await expect.element(page.getByLabelText("Close")).toHaveFocus()
  await userEvent.keyboard("{Enter}")
  await expect.element(shown("Could not switch branch.")).not.toBeInTheDocument()
})

test("Escape closes the notification that has the focus", async () => {
  await mount()
  notify({ message: "Could not switch branch." })
  await expect.element(shown("Could not switch branch.")).toBeVisible()

  await userEvent.keyboard("{F6}")
  await userEvent.tab()
  await userEvent.keyboard("{Escape}")
  await expect.element(shown("Could not switch branch.")).not.toBeInTheDocument()
})

test("an action runs and closes the notification", async () => {
  await mount()
  const retry = vi.fn()
  notify({ message: "The message was not sent.", action: { label: "Retry", onClick: retry } })

  await shown("Retry").click()
  expect(retry).toHaveBeenCalledOnce()
  await expect.element(shown("The message was not sent.")).not.toBeInTheDocument()
})

test("a screen reader announces a failure when it appears", async () => {
  await mount()
  notify({ message: "The message was not sent." })

  await expect.element(page.getByRole("alert")).toHaveTextContent("The message was not sent.")
})
