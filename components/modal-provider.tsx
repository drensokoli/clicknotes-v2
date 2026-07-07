"use client"

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { MediaItem } from './media-card'
import { getMediaHref, isMediaHref } from '@/lib/media-url'

interface ModalContextType {
  isModalOpen: boolean
  modalContent: MediaItem | null
  tmdbApiKey: string | null
  openModal: (item: MediaItem, options?: { seededFromUrl?: boolean }) => void
  closeModal: () => void
  setTmdbApiKey: (key: string) => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export function useModal() {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}

interface ModalProviderProps {
  children: ReactNode
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalContent, setModalContent] = useState<MediaItem | null>(null)
  const [tmdbApiKey, setTmdbApiKey] = useState<string | null>(null)
  const router = useRouter()
  // True when the currently-open modal's URL was already correct on open (a
  // direct visit/share link to /movie/[id] etc. - see app/movie/[id]/page.tsx
  // and components/media-landing-client.tsx) - closing it navigates home
  // instead of back, since there's no prior in-app page to return to.
  const seededFromUrlRef = useRef(false)
  // True once openModal has pushed a history entry for an in-app click, so
  // closeModal knows there's something to pop back to.
  const pushedHistoryRef = useRef(false)

  const openModal = useCallback((item: MediaItem, options?: { seededFromUrl?: boolean }) => {
    setModalContent(item)
    setIsModalOpen(true)
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'

    if (options?.seededFromUrl) {
      seededFromUrlRef.current = true
      return
    }

    // Give every media item its own shareable URL (Netflix/Twitter-style modal
    // routing), but deliberately bypass Next's router: a real router.push would
    // unmount whatever's underneath (Home's grid, Library's filtered view,
    // Shuffle) since they live on a different route. Pushing straight to the
    // History API only changes the visible URL - the page never re-renders, so
    // scroll position, search text, and filters all stay exactly as they were.
    seededFromUrlRef.current = false
    const href = getMediaHref(item.type, item.id)
    if (window.location.pathname !== href) {
      pushedHistoryRef.current = true
      window.history.pushState({ clicknotesModal: true }, '', href)
    }
  }, [])

  const closeModal = useCallback(() => {
    if (seededFromUrlRef.current) {
      router.push('/')
      return
    }
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false
      window.history.back()
      return
    }
    // Nothing was pushed (URL already matched, or opened some other way) -
    // just clear the modal state directly.
    setIsModalOpen(false)
    setModalContent(null)
    document.body.style.overflow = 'unset'
  }, [router])

  // Closing via the browser's own back/forward buttons still needs to clear
  // modal state once the URL no longer points at a media item. This is a raw
  // `popstate` listener (not Next's usePathname) since openModal intentionally
  // changes the URL outside of Next's router - see the note above.
  useEffect(() => {
    const handlePopState = () => {
      if (!isMediaHref(window.location.pathname)) {
        pushedHistoryRef.current = false
        setIsModalOpen(false)
        setModalContent(null)
        document.body.style.overflow = 'unset'
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <ModalContext.Provider value={{ isModalOpen, modalContent, tmdbApiKey, openModal, closeModal, setTmdbApiKey }}>
      {children}
    </ModalContext.Provider>
  )
}
