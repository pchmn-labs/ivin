import { StrictMode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import "../../src/core/theme/tokens.css"
import "../../src/core/theme/base.css"
import "./picker.css"
import "./prototype.css"
import { Dot, Marks, HealthVariant } from "./variants.tsx"

const VARIANTS = [
  { name: "Dot", Component: Dot },
  { name: "Marks", Component: Marks },
  { name: "Health", Component: HealthVariant },
]

const requested = Number.parseInt(new URLSearchParams(location.search).get("v") ?? "", 10)

function Harness() {
  const [current, setCurrent] = useState(
    requested >= 1 && requested <= VARIANTS.length ? requested - 1 : 0,
  )
  const [mountKey, setMountKey] = useState(0)
  const picker = useRef<HTMLElement>(null)
  const highlight = useRef<HTMLSpanElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])

  const select = (i: number) => {
    setCurrent((i + VARIANTS.length) % VARIANTS.length)
    setMountKey((k) => k + 1)
  }

  useLayoutEffect(() => {
    const move = () => {
      const el = items.current[current]
      if (!el || !highlight.current) return
      highlight.current.style.width = `${el.offsetWidth}px`
      highlight.current.style.transform = `translateX(${el.offsetLeft}px)`
    }
    move()
    window.addEventListener("resize", move)
    return () => window.removeEventListener("resize", move)
  }, [current])

  useEffect(() => {
    const url = new URL(location.href)
    url.searchParams.set("v", String(current + 1))
    history.replaceState(null, "", url)
  }, [current])

  const currentRef = useRef(current)
  currentRef.current = current
  useEffect(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => picker.current?.setAttribute("data-ready", "")),
    )
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const num = Number.parseInt(e.key, 10)
      if (num >= 1 && num <= VARIANTS.length) select(num - 1)
      else if (e.key === "ArrowRight") select(currentRef.current + 1)
      else if (e.key === "ArrowLeft") select(currentRef.current - 1)
      else if (e.key === "t") {
        const root = document.documentElement
        root.dataset.theme = root.dataset.theme === "forest-light" ? "forest-dark" : "forest-light"
      }
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [])

  const { Component } = VARIANTS[current]!
  return (
    <>
      <Component key={mountKey} />
      <nav
        className="proto-picker"
        aria-label="Prototype variants"
        ref={picker}
      >
        <span className="proto-picker-highlight" aria-hidden="true" ref={highlight} />
        {VARIANTS.map(({ name }, i) => (
          <button
            key={name}
            ref={(el) => {
              items.current[i] = el
            }}
            className="proto-picker-item"
            data-active={i === current ? "" : undefined}
            aria-current={i === current ? "true" : undefined}
            onClick={() => select(i)}
          >
            {name}
          </button>
        ))}
      </nav>
    </>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
