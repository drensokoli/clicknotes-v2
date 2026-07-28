// The scores OMDB returns beyond the IMDB id. `rottenTomatoes` is the critics
// Tomatometer (e.g. "87%") - OMDB does NOT expose the audience/popcorn score
// (tomatoUserMeter comes back "N/A"), so this is the critics cluster only.
// `metacritic` is the 0-100 Metascore (e.g. "74"); `imdbRating` is x.x/10 (e.g. "8.8").
export interface OmdbData {
  imdbId: string
  rated: string
  runtime: string
  awards: string
  rottenTomatoes?: string
  metacritic?: string
  imdbRating?: string
}

// OMDB's `Ratings` array carries per-source scores; pull the Rotten Tomatoes
// Tomatometer out of it. Metacritic/IMDb are available as their own top-level
// fields (Metascore / imdbRating) which are cleaner to read than the array.
function extractScores(omdbData: Record<string, unknown>): Pick<OmdbData, "rottenTomatoes" | "metacritic" | "imdbRating"> {
  const ratings = Array.isArray(omdbData.Ratings) ? (omdbData.Ratings as Array<{ Source?: string; Value?: string }>) : []
  const rt = ratings.find((r) => r.Source === "Rotten Tomatoes")?.Value
  const isValue = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v !== "N/A"

  return {
    rottenTomatoes: isValue(rt) ? rt : undefined,
    metacritic: isValue(omdbData.Metascore) ? (omdbData.Metascore as string) : undefined,
    imdbRating: isValue(omdbData.imdbRating) ? (omdbData.imdbRating as string) : undefined,
  }
}

export async function getOmdbData(omdbApiKeys: string[], title: string, year: string, type: string): Promise<OmdbData | null> {

  for (const omdbApiKey of omdbApiKeys) {
    const response = await fetch(
      `https://www.omdbapi.com/?apikey=${omdbApiKey}&t=${title}&type=${type}&y=${year}`
    );

    const omdbData = await response.json();
    if (omdbData.Response === "True") {
      return {
        imdbId: omdbData.imdbID,
        rated: omdbData.Rated,
        runtime: omdbData.Runtime,
        awards: omdbData.Awards,
        ...extractScores(omdbData),
      };
    }
  }
  return null;
}
