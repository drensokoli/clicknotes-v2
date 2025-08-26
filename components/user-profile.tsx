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

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-elevated animate-pulse">
        <User className="w-5 h-5 text-muted-foreground" />
      </div>
    )
  }

  if (!session) {
    return (
      <Link href="/login">
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 hover:bg-surface-elevated rounded-full"
          title="Sign In"
        >
          <User className="w-5 h-5" />
        </Button>
      </Link>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden bg-surface-elevated hover:bg-surface-tonal transition-colors duration-200 border-2 border-transparent hover:border-primary/20"
        title={session.user?.name || "User Menu"}
      >
        {session.user?.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name || "User"}
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <User className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 top-12 w-48 bg-surface-elevated border border-border rounded-xl shadow-lg py-2 z-50">
          <div className="px-4 py-2 border-b border-border">
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
            className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-surface-elevated transition-colors"
          >
            <UserCircle className="w-4 h-4 mr-3" />
            Profile
          </button>
          
          <button
            onClick={() => {
              setIsDropdownOpen(false)
              // Add library navigation here
            }}
            className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-surface-elevated transition-colors"
          >
            <Library className="w-4 h-4 mr-3" />
            Library
          </button>
          
          <div className="border-t border-border mt-2 pt-2">
            <button
              onClick={() => {
                setIsDropdownOpen(false)
                signOut()
              }}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
