import { PreviewCard } from "@base-ui/react/preview-card"
import { Suspense, lazy, useSyncExternalStore } from "react"
import type { SessionCardTriggerProps } from "@ivin/plugin-api/ui"
import "./session-card.css"

export type Place = SessionCardTriggerProps["place"]

// One card per place: moving to another trigger while it is open moves this card.
export const cardHandles = {
  row: PreviewCard.createHandle<string>(),
  tab: PreviewCard.createHandle<string>(),
}

const loadPopup = () => import("./session-card-popup.tsx")
const SessionCardParts = lazy(loadPopup)

let wanted = false
const listeners = new Set<() => void>()
const want = () => {
  if (wanted) return
  wanted = true
  listeners.forEach((listener) => listener())
  void loadPopup()
}

// Mounted once in the window. The Root listens from the start, so a hover that began before the parts' code arrived still opens the card.
function PlaceRoot({ place, loaded }: { place: Place; loaded: boolean }) {
  return (
    <PreviewCard.Root handle={cardHandles[place]}>
      {({ payload }) =>
        loaded ? (
          <Suspense fallback={null}>
            <SessionCardParts place={place} payload={payload} />
          </Suspense>
        ) : null
      }
    </PreviewCard.Root>
  )
}

export function SessionCards() {
  const loaded = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    () => wanted,
  )
  return (
    <>
      <PlaceRoot place="row" loaded={loaded} />
      <PlaceRoot place="tab" loaded={loaded} />
    </>
  )
}

export function SessionCardTrigger({ session, place, children }: SessionCardTriggerProps) {
  return (
    <PreviewCard.Trigger
      handle={cardHandles[place]}
      payload={session.id}
      delay={400}
      closeDelay={150}
      onPointerEnter={want}
      onFocus={want}
      render={<div className="iv-session-card-trigger" data-place={place} />}
    >
      {children}
    </PreviewCard.Trigger>
  )
}
