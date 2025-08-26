"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Mount check
  React.useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Handle theme toggle
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="w-9 h-9">
        <div className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl border border-border/30 bg-surface-elevated/50 backdrop-blur-sm hover:bg-surface-elevated hover:border-primary/30 hover:scale-105 transition-all duration-300 shadow-sm hover:shadow-md group"
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 group-hover:text-blue-400 transition-colors" />
        ) : (
          <Moon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 group-hover:text-blue-400 transition-colors" />
        )}
        <span className="sr-only">Toggle theme</span>
      </Button>
      
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 to-primary-hover/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-sm" />
    </div>
  )
}
