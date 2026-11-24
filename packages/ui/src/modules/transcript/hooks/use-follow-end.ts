import { useCallback, useLayoutEffect, useRef } from "react"

// Null `content` while the area does not scroll, so it starts at its end once it does.
export function useFollowEnd<T extends HTMLElement>(content: unknown) {
  const ref = useRef<T>(null)
  const atEnd = useRef(true)
  const onScroll = useCallback(() => {
    const element = ref.current
    if (element) atEnd.current = element.scrollHeight - element.scrollTop - element.clientHeight < 2
  }, [])
  // The scroll event comes a frame after the wheel; an update in between would snap the list back to its end.
  const onWheel = useCallback((event: { deltaY: number }) => {
    if (event.deltaY < 0) atEnd.current = false
  }, [])
  useLayoutEffect(() => {
    const element = ref.current
    if (content === null) atEnd.current = true
    else if (element && atEnd.current) element.scrollTop = element.scrollHeight
  }, [content])
  return { ref, onScroll, onWheel }
}
