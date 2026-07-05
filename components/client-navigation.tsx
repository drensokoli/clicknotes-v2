"use client"

import { useState, useEffect } from "react"
import { Navigation } from "./navigation"

type Section = "movies" | "series" | "books"

// "tvshows" was the URL hash before the Series rename - keep resolving old
// bookmarks/links to the same section instead of falling through to the default.
function normalizeSectionHash(hash: string): Section | null {
  if (hash === "tvshows") return "series"
  if (hash === "movies" || hash === "series" || hash === "books") return hash
  return null
}

interface ClientNavigationProps {
  onSectionChange?: (section: Section) => void
  initialSection?: Section
}

export function ClientNavigation({ onSectionChange, initialSection }: ClientNavigationProps) {
  // Start with undefined to prevent flash of incorrect selected state
  const [activeSection, setActiveSection] = useState<Section | undefined>(undefined)
  const [isInitialized, setIsInitialized] = useState(false)

  // Handle hash changes and section changes
  useEffect(() => {
    const normalized = normalizeSectionHash(window.location.hash.slice(1))
    if (normalized) {
      setActiveSection(normalized)
    } else if (initialSection) {
      setActiveSection(initialSection)
    } else {
      // Default to movies if no hash and no initial section
      setActiveSection("movies")
    }
    setIsInitialized(true)
  }, [initialSection])

  const handleSectionChange = (section: Section) => {
    setActiveSection(section)
    onSectionChange?.(section)
  }

  return (
    <Navigation
      activeSection={activeSection}
      onSectionChange={isInitialized ? handleSectionChange : undefined}
    />
  )
}
