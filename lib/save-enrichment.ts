import { fetchMovieDetails, fetchTVDetails, type MovieDetails, type TVDetails } from "./tmdb-details"
import type { MediaType, SavedCard } from "./saved-media"

// Movies/series saved straight from a title search carry no `details` at all -
// TMDB's /search endpoint returns none (see app/api/tmdb/search/route.ts). Without
// a persisted `runtime`/`episode_run_time`, the Library's max-runtime filter can't
// evaluate them (getRuntime returns null in lib/library-filters.ts) so they slip
// through the cap. This backfills a trimmed `details` block at save time so every
// new save is filterable - and searchable by cast/director/writer (Feature 1) and
// genre - regardless of where it was saved from. Popular/Redis cards already embed
// details, so those skip the fetch.

const SEARCHABLE_CREW_JOBS = new Set(["Director", "Writer", "Screenplay", "Story"])

type SlimDetails = NonNullable<SavedCard["details"]>

// Mirror the trimming population applies (see lib/data-optimization.ts) but keep
// the writers too, not just the director, so people-search covers them.
function slimCredits(credits: MovieDetails["credits"]): SlimDetails["credits"] {
  return {
    cast: (credits?.cast ?? []).slice(0, 10).map((a) => ({
      id: a.id,
      name: a.name,
      character: a.character ?? "",
      profile_path: a.profile_path,
    })),
    crew: (credits?.crew ?? [])
      .filter((c) => c.job && SEARCHABLE_CREW_JOBS.has(c.job))
      .map((c) => ({ id: c.id, name: c.name, job: c.job, profile_path: c.profile_path })),
  }
}

// Keep just the YouTube trailer so the modal's Watch Trailer / embed still work,
// and so its "details already has videos?" cache check treats the save as complete.
function slimVideos(videos: MovieDetails["videos"]): SlimDetails["videos"] {
  const results = videos?.results ?? []
  const trailer =
    results.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ||
    results.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
    results.find((v) => v.site === "YouTube")
  return {
    results: trailer
      ? [{ key: trailer.key, name: trailer.name, site: trailer.site, type: trailer.type, official: trailer.official }]
      : [],
  }
}

function slimMovieDetails(d: MovieDetails): SavedCard["details"] {
  return {
    runtime: d.runtime,
    genres: d.genres,
    credits: slimCredits(d.credits),
    videos: slimVideos(d.videos),
  }
}

function slimSeriesDetails(d: TVDetails): SavedCard["details"] {
  return {
    episode_run_time: d.episode_run_time,
    genres: d.genres,
    number_of_seasons: d.number_of_seasons,
    number_of_episodes: d.number_of_episodes,
    created_by: d.created_by?.map((c) => ({ id: c.id, name: c.name, profile_path: c.profile_path })),
    credits: slimCredits(d.credits),
    videos: slimVideos(d.videos),
  }
}

// Returns the card enriched with a trimmed `details` (+ `genre_ids`) when it's a
// movie/series missing runtime data. Best-effort: on any fetch failure the original
// card is returned unchanged (the modal's own live fetch remains a fallback for
// display, and matchesRuntime still lets unknown-runtime items through).
export async function enrichCardForSave(
  mediaType: MediaType,
  card: SavedCard,
  tmdbApiKey: string | undefined,
): Promise<SavedCard> {
  if (!tmdbApiKey || (mediaType !== "movie" && mediaType !== "series")) return card
  if (card.id === undefined || card.id === null) return card

  try {
    if (mediaType === "movie") {
      // Already has a runtime (e.g. saved from a Popular card) - nothing to do.
      if (typeof card.details?.runtime === "number") return card
      const details = await fetchMovieDetails(Number(card.id), tmdbApiKey)
      if (!details) return card
      return {
        ...card,
        details: slimMovieDetails(details),
        genre_ids: card.genre_ids ?? details.genres.map((g) => g.id),
      }
    }

    // series - treat "no enriched details yet" (no genres block) as needing a fetch,
    // since some shows legitimately have an empty episode_run_time.
    if (card.details?.genres && card.details.genres.length > 0) return card
    const details = await fetchTVDetails(Number(card.id), tmdbApiKey)
    if (!details) return card
    return {
      ...card,
      details: slimSeriesDetails(details),
      genre_ids: card.genre_ids ?? details.genres.map((g) => g.id),
    }
  } catch (error) {
    console.error("Failed to enrich card on save:", error)
    return card
  }
}
