"use client"

import { useState, useEffect } from "react"
import { ClientNavigation } from "./client-navigation"
import { ContentSection } from "./content-section"
import { MediaDetailsModal } from "./media-details-modal"
import type { Movie, TVShow, Book } from "./media-card"

type Section = "movies" | "tvshows" | "books"

interface MainContentProps {
  initialMovies: Movie[]
  initialTVShows: TVShow[]
  initialBooks: Book[]
  tmdbApiKey: string
  googleBooksApiKey: string
  redisKeysFetched: {
    movies: number
    tvshows: number
    books: number
  }
  omdbApiKeys: string[]
}

export function MainContent({
  initialMovies,
  initialTVShows,
  initialBooks,
  tmdbApiKey,
  googleBooksApiKey,
  redisKeysFetched,
  omdbApiKeys
}: MainContentProps) {
  // Start with undefined to prevent flash of incorrect selected state
  const [activeSection, setActiveSection] = useState<Section | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<(Movie | TVShow | Book)[]>([])

  // Handle initial hash on component mount
  useEffect(() => {
    const hash = window.location.hash.slice(1) as Section
    if (hash && ["movies", "tvshows", "books"].includes(hash)) {
      setActiveSection(hash)
    } else {
      // Default to movies if no hash
      setActiveSection("movies")
    }
  }, [])

  const handleSectionChange = (section: Section) => {
    setActiveSection(section)
    setSearchQuery("")
    setSearchResults([])
  }

  const handleSearchChange = (query: string, results: (Movie | TVShow | Book)[]) => {
    setSearchQuery(query)
    setSearchResults(results)
  }

  return (
    <>
      <ClientNavigation
        onSectionChange={handleSectionChange}
        initialSection={activeSection}
      />
      <main>
        <ContentSection
          initialMovies={initialMovies}
          initialTVShows={initialTVShows}
          initialBooks={initialBooks}
          tmdbApiKey={tmdbApiKey}
          googleBooksApiKey={googleBooksApiKey}
          redisKeysFetched={redisKeysFetched}
          externalActiveSection={activeSection}
          externalSearchQuery={searchQuery}
          externalSearchResults={searchResults}
          onSearchChange={handleSearchChange}
        />
        <MediaDetailsModal
          omdbApiKeys={omdbApiKeys}
        />
      </main>
    </>
  )
}
