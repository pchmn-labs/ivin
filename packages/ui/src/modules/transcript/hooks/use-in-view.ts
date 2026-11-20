import { type RefObject, useEffect, useState } from "react"

// True once the element has entered its scrolling ancestor's view; stays true after.
export function useInView(element: RefObject<Element | null>, enabled: boolean) {
  const [seen, setSeen] = useState(!enabled)
  useEffect(() => {
    const target = element.current
    if (seen || !target) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setSeen(true)
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [element, seen])
  return seen
}
