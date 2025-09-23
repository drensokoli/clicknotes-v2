"use client"

import { UserProfile } from "./user-profile"
import Image from "next/image"
import Link from "next/link"
import { Film, Tv, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect, useMemo } from "react"
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"

type Section = "movies" | "tvshows" | "books"

interface NavigationProps {
  activeSection?: Section | undefined
  onSectionChange?: (section: Section) => void
}

export function Navigation({ activeSection, onSectionChange }: NavigationProps) {
  const navItems = useMemo(() => [
    { id: "movies" as Section, label: "Movies", icon: Film },
    { id: "tvshows" as Section, label: "TV", icon: Tv },
    { id: "books" as Section, label: "Books", icon: BookOpen },
  ], [])

  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showSwipeHint, setShowSwipeHint] = useState(false)
  const [isInitialAnimation, setIsInitialAnimation] = useState(false)
  const [hasRunInitialAnimation, setHasRunInitialAnimation] = useState(false)

  // Handle carousel slide changes
  useEffect(() => {
    if (!carouselApi) return

    const onSelect = () => {
      // Don't trigger section changes during initial animation
      if (isInitialAnimation) return

      const selectedIndex = carouselApi.selectedScrollSnap()
      const selectedItem = navItems[selectedIndex]
      if (selectedItem && selectedItem.id !== activeSection && onSectionChange) {
        setIsTransitioning(true)
        // Hide swipe hint when user interacts with carousel
        setShowSwipeHint(false)
        onSectionChange(selectedItem.id)
        window.location.hash = selectedItem.id

        // Reset transition state after animation
        setTimeout(() => setIsTransitioning(false), 300)
      }
    }

    carouselApi.on('select', onSelect)
    return () => {
      carouselApi.off('select', onSelect)
    }
  }, [carouselApi, activeSection, onSectionChange, navItems, isInitialAnimation])

  // Auto-hide swipe hint after 4 seconds
  useEffect(() => {
    if (showSwipeHint) {
      const timer = setTimeout(() => {
        setShowSwipeHint(false)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [showSwipeHint])

  // Sync carousel with active section changes
  useEffect(() => {
    if (carouselApi && activeSection) {
      const index = navItems.findIndex(item => item.id === activeSection)
      if (index >= 0 && index !== carouselApi.selectedScrollSnap()) {
        carouselApi.scrollTo(index)
      }
    }
  }, [activeSection, carouselApi, navItems])

  // Initial animation on page load
  useEffect(() => {
    if (!carouselApi || isInitialAnimation || hasRunInitialAnimation) return

    const runInitialAnimation = async () => {
      setIsInitialAnimation(true)

      const totalItems = navItems.length

      // Phase 1: Extremely fast scrolling through 3 complete cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let i = 0; i < totalItems; i++) {
          await new Promise(resolve => setTimeout(resolve, 4)) // Extremely fast: 4ms per item
          if (carouselApi) {
            carouselApi.scrollTo(i)
          }
        }
      }

      // Phase 2: Quick slow-down to current active section
      const targetIndex = activeSection ? navItems.findIndex(item => item.id === activeSection) : 0

      for (let i = 0; i <= targetIndex; i++) {
        const delay = 8 + (i * 4) // Extremely fast deceleration: 8ms, 12ms, 16ms
        await new Promise(resolve => setTimeout(resolve, delay))
        if (carouselApi) {
          carouselApi.scrollTo(i)
        }
      }

      // Enable interactions immediately after reaching target
      setIsInitialAnimation(false)
      setHasRunInitialAnimation(true)
      // Show swipe hint after animation completes
      setShowSwipeHint(true)
    }

    // Start animation immediately when carousel is ready
    const timer = setTimeout(runInitialAnimation, 100) // Near-instant start

    return () => clearTimeout(timer)
  }, [carouselApi, isInitialAnimation, navItems, hasRunInitialAnimation, activeSection])

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-border/30 bg-surface/70 backdrop-blur-lg shadow-md">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex h-16 sm:h-20 items-center relative">
          {/* Logo - Positioned absolutely on the left */}
          <div className="absolute left-0 flex items-center space-x-2 sm:space-x-4">
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

          {/* Centered Navigation Items - Desktop: All items, Mobile: Only selected icon */}
          <div className="flex items-center justify-center w-full">
            {/* Desktop Navigation - Shows all items with labels */}
            <div className="hidden sm:flex items-center">
              {navItems.map((item, index) => {
                const Icon = item.icon
                const isActive = activeSection === item.id

                return (
                  <div key={item.id} className="flex items-center">
                    {index > 0 && <div className="h-4 w-px bg-gray-400 dark:bg-gray-400 mx-6 opacity-40" />}
                    <button
                      onClick={() => {
                        if (onSectionChange && !isInitialAnimation) {
                          // Show swipe hint on mobile when clicking navigation
                          if (window.innerWidth < 640) {
                            setShowSwipeHint(true)
                          }
                          onSectionChange(item.id)
                          window.location.hash = item.id
                        }
                      }}
                      disabled={!onSectionChange || isInitialAnimation}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1 transition-all duration-300",
                        "sm:hover:scale-105", // Scale effect only on desktop hover
                        "active:scale-95", // Scale down on click for all devices
                        (!onSectionChange || isInitialAnimation) && "cursor-not-allowed opacity-60",
                        isActive ? "text-primary" : "text-gray-500 hover:text-foreground",
                        "hover:cursor-pointer"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-semibold">{item.label}</span>
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Mobile Navigation - Carousel for smooth transitions */}
            <div className="sm:hidden relative">
              <Carousel
                setApi={setCarouselApi}
                className="w-[65px] h-fit"
                opts={{
                  align: "center",
                  loop: true,
                  dragFree: false,
                }}
              >
                <CarouselContent className="-ml-2">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = activeSection === item.id

                    return (
                      <CarouselItem key={item.id} className="pl-2 basis-full">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => {
                              if (onSectionChange && !isTransitioning && !isInitialAnimation) {
                                // Show swipe hint when clicking navigation on mobile
                                setShowSwipeHint(true)
                                onSectionChange(item.id)
                                window.location.hash = item.id
                              }
                            }}
                            disabled={!onSectionChange || isTransitioning || isInitialAnimation}
                            className={cn(
                              "flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 m-2",
                              "active:scale-95",
                              (!onSectionChange || isInitialAnimation) && "cursor-not-allowed opacity-60",
                              isActive
                                ? "text-primary scale-110 bg-primary/10"
                                : "text-gray-500 hover:text-foreground",
                              "hover:cursor-pointer"
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </button>
                        </div>
                      </CarouselItem>
                    )
                  })}
                </CarouselContent>
              </Carousel>
            </div>
          </div>

          {/* User Profile - Positioned absolutely on the right */}
          <div className="absolute right-0 flex items-center">
            <UserProfile />
          </div>
        </div>
      </div>
    </nav>

    {/* Swipe hint badge - only on mobile */}
    {showSwipeHint && (
      <div className="sm:hidden fixed top-16 left-1/2 transform -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top-2 duration-300 pt-1">
        <div className="bg-surface/90 backdrop-blur-sm border border-border/50 rounded-full px-3 py-1 shadow-lg">
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            👆 Swipe to navigate between sections
          </p>
        </div>
      </div>
      )}
    </>
  )
}
