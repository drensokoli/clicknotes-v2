"use client"

import { useEffect, type RefObject } from "react"

// Focuses the given input when "/" is pressed anywhere on the page, unless the
// user is already typing in some other field. Places the cursor at the end of
// any existing text rather than selecting it, so it reads naturally as "resume
// typing" rather than "start over".
export function useSlashFocus(inputRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return

      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return

      const input = inputRef.current
      if (!input) return

      e.preventDefault()
      input.focus()
      const len = input.value.length
      input.setSelectionRange(len, len)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [inputRef])
}
