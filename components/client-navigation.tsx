"use client"

import { useEffect, useState } from "react"
import { Navigation } from "./navigation"

export function ClientNavigation() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Return a skeleton that matches the navigation structure
    return (
      <nav className="sticky top-0 z-50 w-full border-b border-border/30 bg-surface/70 backdrop-blur-lg shadow-md">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex h-16 sm:h-20 items-center justify-between">
            {/* Logo skeleton */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="h-14 w-14 sm:h-18 sm:w-18 bg-muted animate-pulse rounded" />
            </div>

            {/* Theme & Auth skeleton */}
            <div className="flex items-center space-x-4">
              <div className="w-9 h-9 sm:w-11 sm:h-11 bg-muted animate-pulse rounded" />
              <div className="w-9 h-9 sm:w-11 sm:h-11 bg-muted animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      </nav>
    )
  }

  return <Navigation />
}
