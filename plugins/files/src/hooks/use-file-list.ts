import { useEffect, useRef, useState } from "react"
import { useFolderChanges, useListFiles, type FileListing, type Session } from "@ivin/plugin-api/ui"
import { keepListing } from "../rules/keep-listing.ts"

// Listed again after each change on disk while `active`.
export function useFileList(session: Session, active: boolean) {
  const listFiles = useListFiles()
  const [listing, setListing] = useState<FileListing | null>(null)
  const asked = useRef(0)
  const shown = useRef(0)
  const load = () => {
    const call = ++asked.current
    void listFiles(session.id).then((next) => {
      // A listing asked before the one shown is older, however late it arrives.
      if (call < shown.current) return
      shown.current = call
      setListing((current) => keepListing(current, next))
    })
  }
  useEffect(() => {
    if (active) load()
    else {
      shown.current = ++asked.current
      setListing(null)
    }
  }, [active])
  useFolderChanges(session.id, (paths) => {
    if (active && paths.length > 0) load()
  })
  return { listing, retry: load }
}
