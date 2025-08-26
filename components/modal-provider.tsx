"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { MediaItem } from './media-card'

interface ModalContextType {
  isModalOpen: boolean
  modalContent: MediaItem | null
  tmdbApiKey: string | null
  openModal: (item: MediaItem) => void
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

  const openModal = (item: MediaItem) => {
    setModalContent(item)
    setIsModalOpen(true)
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setModalContent(null)
    // Restore body scroll
    document.body.style.overflow = 'unset'
  }

  return (
    <ModalContext.Provider value={{ isModalOpen, modalContent, tmdbApiKey, openModal, closeModal, setTmdbApiKey }}>
      {children}
    </ModalContext.Provider>
  )
}
