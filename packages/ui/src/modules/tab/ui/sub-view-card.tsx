import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { SubView } from "@ivin/contracts/tab"
import { Exit } from "effect"
import { useRef, useState, type KeyboardEvent } from "react"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { fileName } from "../../file/rules/file-name.ts"
import { FileView } from "../../file/ui/file-view.tsx"
import { closeSubViewAtom } from "../atoms/close-sub-view.ts"
import { subViewsOf } from "../atoms/list-sub-views.ts"
import { openSubViewAtom } from "../atoms/open-sub-view.ts"
import { closeFileFailure } from "../rules/sub-view-failure.ts"
import { sameSubView, subViewKey } from "../rules/sub-views.ts"
import "./sub-view-card.css"

const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
  const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const current = tabs.indexOf(document.activeElement as HTMLButtonElement)
  const target = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: tabs.length - 1 }[
    event.key
  ]
  const next = target === undefined ? undefined : tabs[target]
  if (current < 0 || next === undefined || target === current) return
  event.preventDefault()
  next.focus()
  next.click()
}

export function SubViewCard({
  sessionId,
  workingFolder,
}: {
  sessionId: string
  workingFolder: string
}) {
  const { subViews, selected } = useAtomValue(subViewsOf(sessionId, workingFolder).value)
  const open = useAtomSet(openSubViewAtom)
  const close = useAtomSet(closeSubViewAtom, { mode: "promiseExit" })
  const [closeFailure, setCloseFailure] = useState<SubView | null>(null)
  const card = useRef<HTMLElement>(null)

  const closeFile = async (subView: SubView) => {
    const hadFocus = card.current?.contains(document.activeElement) ?? false
    setCloseFailure(null)
    const exit = await close({ sessionId, workingFolder, subView })
    if (Exit.isFailure(exit)) return setCloseFailure(subView)
    // The focused close button is gone with its tab.
    if (hadFocus)
      card.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus()
  }
  useCommandHandler("tab.closeFile", () => selected && void closeFile(selected), selected !== null)

  if (selected === null) return null

  return (
    <section ref={card} className="iv-sub-view-card" aria-label="Open files">
      <div
        className="iv-sub-view-card__tabs"
        role="tablist"
        aria-label="Open files"
        onKeyDown={moveFocus}
      >
        {subViews.map((subView) => {
          const isSelected = sameSubView(subView, selected)
          const name = fileName(subView.path)
          const closeThis = () => closeFile(subView)
          return (
            <div
              key={subViewKey(subView)}
              className="iv-sub-view-card__item"
              role="presentation"
              data-selected={isSelected || undefined}
              onMouseDown={(event) => {
                // Stops the browser's middle-click autoscroll.
                if (event.button === 1) event.preventDefault()
              }}
              onAuxClick={(event) => {
                if (event.button !== 1) return
                event.preventDefault()
                void closeThis()
              }}
            >
              <button
                type="button"
                role="tab"
                className="iv-sub-view-card__tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                title={subView.path}
                onClick={() => open({ sessionId, workingFolder, subView })}
              >
                <span className="iv-sub-view-card__icon" aria-hidden>
                  <Icon name="file" size={14} />
                </span>
                <span className="iv-sub-view-card__name">{name}</span>
              </button>
              <button
                type="button"
                className="iv-sub-view-card__close"
                aria-label={`Close ${name}`}
                onClick={() => void closeThis()}
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          )
        })}
      </div>
      {closeFailure !== null && (
        <div className="iv-sub-view-card__failure">
          <ErrorMessage
            message={closeFileFailure(closeFailure.path)}
            onRetry={() => void closeFile(closeFailure)}
          />
        </div>
      )}
      <div className="iv-sub-view-card__body" role="tabpanel" aria-label={fileName(selected.path)}>
        <FileView
          key={subViewKey(selected)}
          sessionId={sessionId}
          workingFolder={workingFolder}
          path={selected.path}
        />
      </div>
    </section>
  )
}
