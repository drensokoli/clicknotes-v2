"use client"

import { PillGroup } from "./pill-group"
import { MOVIE_GENRES, TV_GENRES } from "@/lib/tmdb-details"

interface PopularGenrePillsProps {
  mediaType: "movie" | "tv"
  selectedGenreIds: Set<number>
  onGenreIdsChange: (next: Set<number>) => void
}

// Shown above the Popular grid for movies/series (not books) when there's no
// active search. Picking a genre switches the grid's data source to a live
// TMDB discover call (see components/content-section.tsx and
// app/api/tmdb/discover/route.ts) rather than filtering the Redis-cached
// Popular list, which isn't partitioned by genre and wouldn't have a deep
// enough pool for a niche genre. Genre id (not name) is the selection value
// since that's what the discover call needs directly.
export function PopularGenrePills({ mediaType, selectedGenreIds, onGenreIdsChange }: PopularGenrePillsProps) {
  const genreMap = mediaType === "movie" ? MOVIE_GENRES : TV_GENRES
  const genreIds = Object.keys(genreMap)
    .map(Number)
    .sort((a, b) => genreMap[a].localeCompare(genreMap[b]))

  return (
    <div className="mb-5">
      <PillGroup
        label="Browse by genre"
        options={genreIds}
        selected={selectedGenreIds}
        onChange={onGenreIdsChange}
        renderLabel={(id) => genreMap[id]}
      />
    </div>
  )
}
