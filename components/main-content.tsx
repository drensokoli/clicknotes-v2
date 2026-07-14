"use client"

import { useState, useEffect } from "react"
import { ClientNavigation } from "./client-navigation"
import { ContentSection } from "./content-section"
import type { Movie, Series, Book } from "./media-card"

type Section = "movies" | "series" | "books"

interface MainContentProps {
  initialMovies: Movie[]
  initialSeries: Series[]
  initialBooks: Book[]
  movieRanking?: Array<{value: string, score: number}>
  seriesRanking?: Array<{value: string, score: number}>
  bookRanking?: Array<{value: string, score: number}>
  tmdbApiKey: string
  googleBooksApiKey: string
  redisKeysFetched: {
    movies: number
    series: number
    books: number
  }
}

export function MainContent({
  initialMovies,
  initialSeries,
  initialBooks,
  movieRanking = [],
  seriesRanking = [],
  bookRanking = [],
  tmdbApiKey,
  googleBooksApiKey,
  redisKeysFetched,
}: MainContentProps) {
  // Start with undefined to prevent flash of incorrect selected state
  const [activeSection, setActiveSection] = useState<Section | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<(Movie | Series | Book)[]>([])

  // Handle initial hash on component mount
  useEffect(() => {
    const rawHash = window.location.hash.slice(1)
    // "tvshows" was the URL hash before the Series rename - keep resolving old
    // bookmarks/links to the same section.
    const hash = rawHash === "tvshows" ? "series" : (rawHash as Section)
    if (hash && ["movies", "series", "books"].includes(hash)) {
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

  // Kept as two separate handlers (rather than one combined onSearchChange) so a
  // debounced results update can never overwrite the query the user is currently
  // typing - see the note in content-section.tsx's setSearchResults for the race
  // condition this avoids.
  const handleQueryChange = (query: string) => {
    setSearchQuery(query)
  }

  const handleResultsChange = (results: (Movie | Series | Book)[]) => {
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
          initialSeries={initialSeries}
          initialBooks={initialBooks}
          movieRanking={movieRanking}
          seriesRanking={seriesRanking}
          bookRanking={bookRanking}
          tmdbApiKey={tmdbApiKey}
          googleBooksApiKey={googleBooksApiKey}
          redisKeysFetched={redisKeysFetched}
          externalActiveSection={activeSection}
          externalSearchQuery={searchQuery}
          externalSearchResults={searchResults}
          onQueryChange={handleQueryChange}
          onResultsChange={handleResultsChange}
        />
      </main>
    </>
  )
}
