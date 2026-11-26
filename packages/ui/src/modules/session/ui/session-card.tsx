import { PreviewCard } from "@base-ui/react/preview-card"
import { Suspense, createContext, lazy, useContext, useMemo, useState, type ReactNode } from "react"
import type { SessionCardTriggerProps } from "@ivin/plugin-api/ui"
import "./session-card.css"

export type Place = SessionCardTriggerProps["place"]

type Handles = Readonly<Record<Place, PreviewCard.Handle<string>>>

const loadPopup = () => import("./session-card-popup.tsx")
const SessionCardParts = lazy(loadPopup)

const CardContext = createContext<{ readonly handles: Handles; readonly want: () => void } | null>(
  null,
)

// The Root listens from the start, so a hover that began before the parts' code arrived still opens the card.
function PlaceRoot({
  place,
  handle,
  loaded,
}: {
  place: Place
  handle: PreviewCard.Handle<string>
  loaded: boolean
}) {
  return (
    <PreviewCard.Root handle={handle}>
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

// Around the window's content: one card per place, which moves to another trigger hovered while it is open.
export function SessionCards({ children }: { readonly children: ReactNode }) {
  const [handles] = useState<Handles>(() => ({
    row: PreviewCard.createHandle<string>(),
    tab: PreviewCard.createHandle<string>(),
  }))
  const [loaded, setLoaded] = useState(false)
  const context = useMemo(
    () => ({
      handles,
      want: () => {
        setLoaded(true)
        void loadPopup()
      },
    }),
    [handles],
  )
  return (
    <CardContext value={context}>
      {children}
      <PlaceRoot place="row" handle={handles.row} loaded={loaded} />
      <PlaceRoot place="tab" handle={handles.tab} loaded={loaded} />
    </CardContext>
  )
}

export function SessionCardTrigger({ session, place, children }: SessionCardTriggerProps) {
  const context = useContext(CardContext)
  if (context === null) {
    return (
      <div className="iv-session-card-trigger" data-place={place}>
        {children}
      </div>
    )
  }
  return (
    <PreviewCard.Trigger
      handle={context.handles[place]}
      payload={session.id}
      delay={400}
      closeDelay={150}
      onPointerEnter={context.want}
      onFocus={context.want}
      render={<div className="iv-session-card-trigger" data-place={place} />}
    >
      {children}
    </PreviewCard.Trigger>
  )
}
