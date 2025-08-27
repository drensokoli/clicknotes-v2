"use client"

import { ThemeToggle } from "./theme-toggle"
import { UserProfile } from "./user-profile"
import Image from "next/image"
import Link from "next/link"

export function Navigation() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/30 bg-surface/70 backdrop-blur-lg shadow-md">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex h-16 sm:h-20 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/" className="flex items-center space-x-2 sm:space-x-3">
              <div className="h-14 w-14 sm:h-18 sm:w-18 relative">
                <Image
                  src="/logo-blue.png"
                  alt="ClickNotes Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
          </div>

          {/* Theme & Auth */}
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <UserProfile />
          </div>
        </div>
      </div>
    </nav>
  )
}
