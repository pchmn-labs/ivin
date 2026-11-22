import { Fragment } from "react"
import type { StepsProps } from "@ivin/plugin-api/ui"
import { Icon } from "../icon/icon.tsx"
import "./steps.css"

export type { StepsProps }

export function Steps({ label, steps, current, onSelect }: StepsProps) {
  return (
    <nav className="iv-steps" aria-label={label}>
      {steps.map((step, index) => {
        const done = step.done && index !== current
        return (
          <Fragment key={index}>
            {index === 0 ? null : <span className="iv-steps__line" aria-hidden="true" />}
            <button
              type="button"
              className="iv-steps__step"
              // The keyboard moves between steps with the arrows of the content they head.
              tabIndex={-1}
              aria-current={index === current ? "step" : undefined}
              data-done={done || undefined}
              onClick={() => onSelect?.(index)}
            >
              <span className="iv-steps__dot" aria-hidden="true">
                {done ? <Icon name="check" size={12} /> : index + 1}
              </span>
              {step.label}
            </button>
          </Fragment>
        )
      })}
    </nav>
  )
}
