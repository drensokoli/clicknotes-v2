"use client"

import { useSession, signOut } from "next-auth/react"
import { User, LogOut, UserCircle, Library } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useState, useRef, useEffect } from "react"
import Link from "next/link"

export function UserProfile() {
  const { data: session, status } = useSession()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  if (!mounted || status === "loading") {
    return (
      <div className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 animate-pulse">
        <div className="w-5 h-5 rounded-full bg-muted animate-pulse" />
      </div>
    )
  }

  if (!mounted || !session) {
    return (
      <Link href="/login">
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 sm:w-11 sm:h-11 hover:bg-transparent hover:scale-110 transition-all duration-300"
          title="Sign In"
        >
          <User className="w-5 h-5 text-primary" />
        </Button>
      </Link>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full overflow-hidden hover:scale-110 transition-all duration-300 border-2 border-transparent"
        title={session.user?.name || "User Menu"}
      >
        {session.user?.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name || "User"}
            width={30}
            height={30}
            className="rounded-full"
          />
        ) : (
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 top-12 w-48 bg-surface rounded-xl py-2 z-50">
          <div className="px-4 py-2 border-b border-border/30">
            <p className="text-sm font-medium text-foreground">
              {session.user?.name || "User"}
            </p>
            <p className="text-xs text-muted-foreground">
              {session.user?.email}
            </p>
          </div>
          
          <button
            onClick={() => {
              setIsDropdownOpen(false)
              // Add profile navigation here
            }}
            className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-surface/80 transition-colors"
          >
            <UserCircle className="w-4 h-4 mr-3" />
            Profile
          </button>
          
          <button
            onClick={() => {
              setIsDropdownOpen(false)
              // Add library navigation here
            }}
            className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-surface/80 transition-colors"
          >
            <Library className="w-4 h-4 mr-3" />
            Library
          </button>
          
          <div className="border-t border-border/30 mt-2 pt-2">
            <button
              onClick={() => {
                setIsDropdownOpen(false)
                signOut()
              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
