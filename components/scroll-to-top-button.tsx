"use client"

import { useEffect, useState, type RefObject } from "react"
import { ArrowUp } from "lucide-react"

interface ScrollToTopButtonProps {
  // Optional independently-scrolling container (e.g. the Library grid pane) to
  // watch/scroll in addition to the window - harmless if it never scrolls (e.g.
  // on mobile, where that pane isn't height-capped and the whole page scrolls
  // instead). Omit entirely for plain whole-page scrolling (e.g. the homepage).
  target?: RefObject<HTMLElement | null>
  threshold?: number
}

export function ScrollToTopButton({ target, threshold = 400 }: ScrollToTopButtonProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const targetTop = target?.current?.scrollTop ?? 0
      setVisible(window.scrollY > threshold || targetTop > threshold)
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    const node = target?.current
    node?.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", handleScroll)
      node?.removeEventListener("scroll", handleScroll)
    }
  }, [target, threshold])

  if (!visible) return null

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
    target?.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-primary border border-border/40 shadow-lg flex items-center justify-center text-white hover:bg-blue-800 transition-colors hover:cursor-pointer"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  )
}
