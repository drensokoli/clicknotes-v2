"use client"

import { useState, useEffect } from "react"
import { Navigation } from "./navigation"

type Section = "movies" | "tvshows" | "books"

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
    const hash = window.location.hash.slice(1) as Section
    if (hash && ["movies", "tvshows", "books"].includes(hash)) {
      setActiveSection(hash)
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
