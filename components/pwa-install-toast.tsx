'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import Image from 'next/image'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

// Extend Navigator interface to include standalone property
interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

export function PWAInstallToast() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [showIOSModal, setShowIOSModal] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Check if PWA is already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as NavigatorWithStandalone).standalone === true
    if (isStandalone) return

    // Check if user has dismissed the toast recently (within 2 weeks)
    const dismissedTimestamp = localStorage.getItem('pwa-toast-dismissed-timestamp')
    if (dismissedTimestamp) {
      const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000) // 2 weeks in milliseconds
      if (parseInt(dismissedTimestamp) > twoWeeksAgo) {
        return // Don't show toast if dismissed within 2 weeks
      } else {
        // Clear old dismissal if it's been more than 2 weeks
        localStorage.removeItem('pwa-toast-dismissed-timestamp')
        // Also clear any old dismissal flags that might exist
        localStorage.removeItem('pwa-toast-dismissed')
      }
    }

    // Check if this is not the user's first visit
    const hasVisitedBefore = localStorage.getItem('pwa-first-visit')
    if (hasVisitedBefore) return

    // Detect iOS devices (including iPadOS)
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                       (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document)
    setIsIOS(isIOSDevice)

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Show toast after 3 seconds for both iOS and non-iOS users
    const timer = setTimeout(() => {
      // Mark that user has visited before (prevents showing on subsequent visits)
      localStorage.setItem('pwa-first-visit', 'true')

      // For iOS, show toast to guide users through manual installation
      if (isIOSDevice) {
        setShowToast(true)
      }
      // For other devices, show toast if PWA is installable
      else if ('serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window) {
        setShowToast(true)
      }
    }, 3000)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      clearTimeout(timer)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        console.log('User accepted the install prompt')
      } else {
        console.log('User dismissed the install prompt')
      }

      setDeferredPrompt(null)
      setShowToast(false)

      // Mark that user has visited before (prevents showing on subsequent visits)
      localStorage.setItem('pwa-first-visit', 'true')
    } catch (error) {
      console.error('Install prompt failed:', error)
    }
  }

  const handleIOSInstall = () => {
    setShowToast(false)
    setShowIOSModal(true)
  }

  const dismissToast = () => {
    setShowToast(false)
    // Store dismissal timestamp for 2-week cooldown
    localStorage.setItem('pwa-toast-dismissed-timestamp', Date.now().toString())
  }

  if (!showToast && !showIOSModal) return null

  return (
    <>
      {/* PWA Install Toast */}
      {showToast && !isIOS && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-sm mx-auto">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--foreground)] text-base">Install ClickNotes</h3>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">Add to your home screen for the best experience</p>
              </div>
              <button
                onClick={dismissToast}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors ml-2 flex-shrink-0 hover:cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={handleInstall}
              className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium py-2.5 px-4 rounded-md transition-colors hover:cursor-pointer"
            >
              Install
            </button>
          </div>
        </div>
      )}

      {/* iOS Installation Modal */}
      {showIOSModal && isIOS && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--surface)] rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Install ClickNotes</h2>
              <button
                onClick={() => {
                  setShowIOSModal(false)
                  // Mark that user has visited before and store dismissal timestamp
                  localStorage.setItem('pwa-first-visit', 'true')
                  localStorage.setItem('pwa-toast-dismissed-timestamp', Date.now().toString())
                }}
                className="text-[var(--muted)] hover:text-[var(--foreground)] hover:cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-[var(--muted-foreground)]">
                To install ClickNotes on your iOS device:
              </p>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-[var(--surface-elevated)] rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-[var(--primary)]">1</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-[var(--foreground)] mb-2">
                      Tap the <strong>Share</strong> button in Safari
                    </p>
                    <div className="bg-[var(--surface-elevated)] rounded-lg flex items-center justify-center">
                      <Image
                        src="/ios-share-button.png"
                        alt="iOS Share Button"
                        width={200}
                        height={100}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-[var(--surface-elevated)] rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-[var(--primary)]">2</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-[var(--foreground)] mb-2">
                      Scroll down and tap <strong>Add to Home Screen</strong>
                    </p>
                    <div className="bg-[var(--surface-elevated)] rounded-lg flex items-center justify-center">
                      <Image
                        src="/ios-add-to-home-screen.png"
                        alt="iOS Add to Home Screen"
                        width={200}
                        height={100}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-[var(--surface-elevated)] rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-[var(--primary)]">3</span>
                  </div>
                  <p className="text-sm text-[var(--foreground)] pt-1">
                    Tap <strong>Add</strong> in the top right corner
                  </p>
                </div>
              </div>

              <div className="bg-[var(--surface-elevated)] p-3 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)]">
                  💡 <strong>Tip:</strong> You can also tap the address bar and pull down to reveal the &ldquo;Add to Home Screen&rdquo; option.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setShowIOSModal(false)
                // Mark that user has visited before and store dismissal timestamp
                localStorage.setItem('pwa-first-visit', 'true')
                localStorage.setItem('pwa-toast-dismissed-timestamp', Date.now().toString())
              }}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors hover:cursor-pointer"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* iOS Toast */}
      {showToast && isIOS && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-sm mx-auto">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--foreground)] text-base">Install ClickNotes</h3>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">Add to your home screen for the best experience</p>
              </div>
              <button
                onClick={dismissToast}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors ml-2 flex-shrink-0 hover:cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={handleIOSInstall}
              className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium py-2.5 px-4 rounded-md transition-colors hover:cursor-pointer"
            >
              How to Install
            </button>
          </div>
        </div>
      )}
    </>
  )
}
