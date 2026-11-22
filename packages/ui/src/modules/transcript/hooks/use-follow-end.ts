import { useCallback, useLayoutEffect, useRef } from "react"

// Keeps a scroll area at its end each time `content` changes, until the user scrolls away from the end.
export function useFollowEnd<T extends HTMLElement>(content: unknown) {
  const ref = useRef<T>(null)
  const atEnd = useRef(true)
  const onScroll = useCallback(() => {
    const element = ref.current
    if (element) atEnd.current = element.scrollHeight - element.scrollTop - element.clientHeight < 2
  }, [])
  useLayoutEffect(() => {
    const element = ref.current
    if (element && atEnd.current) element.scrollTop = element.scrollHeight
  }, [content])
  return { ref, onScroll }
}
