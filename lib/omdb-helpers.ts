export async function getOmdbData(omdbApiKeys: string[], title: string, year: string, type: string) {

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
      };
    }
  }
  return null;
}
