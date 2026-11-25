import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react"

export interface Variant {
  readonly name: string
  readonly Component: ComponentType
}

const requested = Number.parseInt(new URLSearchParams(location.search).get("v") ?? "", 10)

export function Harness({
  variants,
  position,
}: {
  variants: ReadonlyArray<Variant>
  position?: "top"
}) {
  const [current, setCurrent] = useState(
    requested >= 1 && requested <= variants.length ? requested - 1 : 0,
  )
  const [mountKey, setMountKey] = useState(0)
  const picker = useRef<HTMLElement>(null)
  const highlight = useRef<HTMLSpanElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])

  const select = (i: number) => {
    setCurrent((i + variants.length) % variants.length)
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
      if (num >= 1 && num <= variants.length) select(num - 1)
      else if (e.key === "ArrowRight") select(currentRef.current + 1)
      else if (e.key === "ArrowLeft") select(currentRef.current - 1)
      else if (e.key === "r" || e.key === "R") setMountKey((k) => k + 1)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const { Component } = variants[current]
  return (
    <>
      <Component key={mountKey} />
      <nav
        className="proto-picker"
        aria-label="Prototype variants"
        data-position={position}
        ref={picker}
      >
        <span className="proto-picker-highlight" aria-hidden="true" ref={highlight} />
        {variants.map(({ name }, i) => (
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
        <span className="proto-picker-divider" aria-hidden="true" />
        <button
          className="proto-picker-item proto-picker-replay"
          aria-label="Replay animation (R)"
          onClick={() => setMountKey((k) => k + 1)}
        >
          ↻
        </button>
      </nav>
    </>
  )
}
