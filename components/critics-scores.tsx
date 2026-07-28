// Critics-score cluster shown in the detail modal for movies/series. All three
// values come from OMDB (see lib/omdb-helpers.ts): Rotten Tomatoes is the critics
// Tomatometer (OMDB doesn't expose the audience/popcorn score), Metacritic is the
// 0-100 Metascore, IMDb is x.x/10. Each chip only renders when its value exists.

interface CriticsScoresProps {
  rottenTomatoes?: string
  metacritic?: string
  imdbRating?: string
  // For constructing clickable links to the respective sites
  title?: string
  imdbId?: string
}

// Search results rather than a guessed title-page slug: neither site exposes a
// lookup API, and a guessed slug can 404 on an unusual title or a name shared by
// two releases. Search always lands somewhere useful.
function buildRottenTomatoesSearchUrl(title: string): string {
  return `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`
}

function buildMetacriticSearchUrl(title: string): string {
  return `https://www.metacritic.com/search/${encodeURIComponent(title)}/`
}

// Fresh (>=60%) shows a red tomato; rotten (<60%) shows a green splat - the two
// famous Tomatometer icons.
function TomatoIcon({ fresh }: { fresh: boolean }) {
  if (fresh) {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
        <path d="M6.5 6.2c-.5-1 .2-2.2 1.2-1.9.4-1 1.8-1 2.2 0 .6-.9 2-.5 2.1.5.9-.6 2 .2 1.7 1.2z" fill="#0f8a3c" />
        <path d="M12 5.5c4.4 0 8 3.2 8 7.6 0 4-3.6 6.9-8 6.9s-8-2.9-8-6.9c0-4.4 3.6-7.6 8-7.6z" fill="#e2231a" />
        <ellipse cx="9" cy="11.5" rx="1.4" ry="1.9" fill="#fff" opacity=".35" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path
        d="M12 3.5c1 1.6 2.7 1.2 3.4 2.6.4-.3 1.3.1 1.2.9 1.3.1 1.7 1.4.9 2.2 1.4.4 1.2 2.2-.2 2.6.9 1-.2 2.4-1.5 2.3.4 1.3-1 2.6-2.3 2.1-.1 1.4-1.8 1.9-2.7 1-1 1.1-3 .6-3.2-.8-1.1.7-2.7-.2-2.6-1.4-1.4.2-2.3-1.2-1.6-2.3-1.2-.6-1-2.4.3-2.6-.5-1.2.8-2.3 2-1.8.4-1.3 2.1-1.4 2.9-.5.4-.9 1.2-1.3 2-1.1z"
        fill="#00a92b"
      />
      <circle cx="10" cy="12" r="1" fill="#0b6b1f" />
      <circle cx="14" cy="11" r=".9" fill="#0b6b1f" />
      <circle cx="12.5" cy="14" r=".8" fill="#0b6b1f" />
    </svg>
  )
}

function metacriticColor(score: number): string {
  if (score >= 61) return "#00ce7a"
  if (score >= 40) return "#ffbd3f"
  return "#ff6874"
}

export function CriticsScores({ rottenTomatoes, metacritic, imdbRating, title, imdbId }: CriticsScoresProps) {
  if (!rottenTomatoes && !metacritic && !imdbRating) return null

  const rtNumber = rottenTomatoes ? parseInt(rottenTomatoes, 10) : null
  const metaNumber = metacritic ? parseInt(metacritic, 10) : null

  const rtUrl = title ? buildRottenTomatoesSearchUrl(title) : null
  const metaUrl = title ? buildMetacriticSearchUrl(title) : null
  const imdbUrl = imdbId ? `https://www.imdb.com/title/${imdbId}` : null

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Critics Scores
      </h3>
      <div className="flex flex-wrap items-stretch gap-3">
        {rottenTomatoes && rtUrl && (
          <a
            href={rtUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-elevated hover:bg-border transition-colors hover:cursor-pointer"
            title="View on Rotten Tomatoes"
          >
            <TomatoIcon fresh={rtNumber !== null && rtNumber >= 60} />
            <div className="leading-tight">
              <p className="text-sm font-bold text-foreground">{rottenTomatoes}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Rotten Tomatoes</p>
            </div>
          </a>
        )}

        {metaNumber !== null && metaUrl && (
          <a
            href={metaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-elevated hover:bg-border transition-colors hover:cursor-pointer"
            title="View on Metacritic"
          >
            <span
              className="flex items-center justify-center w-8 h-8 rounded text-sm font-bold text-black"
              style={{ backgroundColor: metacriticColor(metaNumber) }}
            >
              {metaNumber}
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-foreground">{metaNumber}/100</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Metacritic</p>
            </div>
          </a>
        )}

        {imdbRating && imdbUrl && (
          <a
            href={imdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-elevated hover:bg-border transition-colors hover:cursor-pointer"
            title="View on IMDb"
          >
            <span className="flex items-center justify-center px-1.5 h-6 rounded-sm bg-[#f5c518] text-black text-xs font-black tracking-tight">
              IMDb
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-foreground">{imdbRating}/10</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">IMDb Rating</p>
            </div>
          </a>
        )}
      </div>
    </div>
  )
}
