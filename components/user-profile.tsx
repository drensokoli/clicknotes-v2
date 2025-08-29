"use client"

import { useSession, signOut } from "next-auth/react"
import { User, LogOut, UserCircle, Library, Moon, Sun, Monitor } from "lucide-react"
import Image from "next/image"
import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"

// Mobile detection hook
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }

    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  return isMobile
}

export function UserProfile() {
  const { data: session, status } = useSession()
  const { theme, setTheme } = useTheme()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  // Handle theme change
  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    // Keep dropdown open after theme change
  }

  // Mobile theme cycling function
  const cycleTheme = () => {
    const themes = ["system", "light", "dark"]
    const currentIndex = themes.indexOf(theme || "system")
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

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
      <div className="flex items-center justify-center w-14 h-14 sm:w-12 sm:h-12">
        <div className="w-7 h-7 rounded-full bg-muted" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center justify-center w-12 h-12 sm:w-11 sm:h-11 rounded-full hover:scale-110 transition-all duration-300 border-2 border-transparent"
          title="User Menu"
        >
          <User className="w-6 h-6 sm:w-6 sm:h-6 text-primary" />
        </button>

        {/* Dropdown Menu for Non-logged-in Users */}
        {isDropdownOpen && (
          <div className="absolute right-0 top-12 w-48 bg-background rounded-xl py-2 z-50 shadow-lg border border-border">
            <div className="px-4 py-2 border-b border-border">
              <p className="text-sm font-medium text-foreground">
                Guest User
              </p>
              <p className="text-xs text-muted-foreground">
                Not signed in
              </p>
            </div>

            <Link href="/login">
              <button
                onClick={() => setIsDropdownOpen(false)}
                className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-muted/10  dark:hover:bg-muted/20 transition-colors "
              >
                <UserCircle className="w-4 h-4 mr-3" />
                Sign In
              </button>
            </Link>

            {/* Theme Toggle - Mobile vs Desktop */}
            {isMobile ? (
              <button
                onClick={cycleTheme}
                className="flex items-center w-full px-4 py-2 text-sm text-foreground transition-colors "
              >
                {theme === "system" && <Monitor className="w-4 h-4 mr-3" />}
                {theme === "light" && <Sun className="w-4 h-4 mr-3" />}
                {theme === "dark" && <Moon className="w-4 h-4 mr-3" />}
                Theme
              </button>
            ) : (
              <div className="px-2 flex items-center w-full text-sm text-foreground transition-colors cursor-pointer">
                <div className="toggle-group">
                  {/* System Theme */}
                  <input
                    type="radio"
                    name="theme"
                    id="system"
                    value="system"
                    checked={theme === "system"}
                    onChange={() => handleThemeChange("system")}
                  />
                  <label htmlFor="system" title="System theme">
                    <Monitor className="w-4 h-4" />
                  </label>

                  {/* Light Theme */}
                  <input
                    type="radio"
                    name="theme"
                    id="light"
                    value="light"
                    checked={theme === "light"}
                    onChange={() => handleThemeChange("light")}
                  />
                  <label htmlFor="light" title="Light theme">
                    <Sun className="w-4 h-4" />
                  </label>

                  {/* Dark Theme */}
                  <input
                    type="radio"
                    name="theme"
                    id="dark"
                    value="dark"
                    checked={theme === "dark"}
                    onChange={() => handleThemeChange("dark")}
                  />
                  <label htmlFor="dark" title="Dark theme">
                    <Moon className="w-4 h-4" />
                  </label>
                </div>
                Theme
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center justify-center w-12 h-12 sm:w-11 sm:h-11 rounded-full overflow-hidden hover:scale-110 transition-all duration-300 border-2 border-transparent"
        title={session.user?.name || "User Menu"}
      >
        {session.user?.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name || "User"}
            width={36}
            height={36}
            className="rounded-full"
          />
        ) : (
          <User className="w-5 h-5 sm:w-5 sm:h-5 text-primary" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 top-12 w-48 bg-background rounded-xl py-2 z-50 shadow-lg border border-border">
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
            className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-muted/10  dark:hover:bg-muted/20 transition-colors "
          >
            <UserCircle className="w-4 h-4 mr-3" />
            Profile
          </button>

          <button
            onClick={() => {
              setIsDropdownOpen(false)
              // Add library navigation here
            }}
            className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-muted/10  dark:hover:bg-muted/20 transition-colors "
          >
            <Library className="w-4 h-4 mr-3" />
            Library
          </button>

          {/* Theme Toggle - Mobile vs Desktop */}
          {isMobile ? (
            <button
              onClick={cycleTheme}
              className="flex items-center w-full px-4 py-2 text-sm text-foreground transition-colors "
            >
              {theme === "system" && <Monitor className="w-4 h-4 mr-3" />}
              {theme === "light" && <Sun className="w-4 h-4 mr-3" />}
              {theme === "dark" && <Moon className="w-4 h-4 mr-3" />}
              Theme
            </button>
          ) : (
            <div className="px-2 flex items-center w-full text-sm text-foreground transition-colors cursor-pointer">
              <div className="toggle-group">
                {/* System Theme */}
                <input
                  type="radio"
                  name="theme-logged-in"
                  id="system-logged-in"
                  value="system"
                  checked={theme === "system"}
                  onChange={() => handleThemeChange("system")}
                />
                <label htmlFor="system-logged-in" title="System theme">
                  <Monitor className="w-4 h-4" />
                </label>

                {/* Light Theme */}
                <input
                  type="radio"
                  name="theme-logged-in"
                  id="light-logged-in"
                  value="light"
                  checked={theme === "light"}
                  onChange={() => handleThemeChange("light")}
                />
                <label htmlFor="light-logged-in" title="Light theme">
                  <Sun className="w-4 h-4" />
                </label>

                {/* Dark Theme */}
                <input
                  type="radio"
                  name="theme-logged-in"
                  id="dark-logged-in"
                  value="dark"
                  checked={theme === "dark"}
                  onChange={() => handleThemeChange("dark")}
                />
                <label htmlFor="dark-logged-in" title="Dark theme">
                  <Moon className="w-4 h-4" />
                </label>
              </div>
              Theme
            </div>
          )}
          
          <div className="border-t border-border mt-2 pt-2">
            <button
              onClick={() => {
                setIsDropdownOpen(false)
                signOut()
              }}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-muted/10 dark:hover:bg-muted/20 transition-colors "
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
