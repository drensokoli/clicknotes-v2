// Shared quality/safety bar for any TMDB movie/series candidate - used by the
// Redis population job (app/api/cron/route.ts) and by the live genre-discover
// route (app/api/tmdb/discover/route.ts) so browsing "Popular by genre" holds
// the same standard as the cached Popular grid, instead of drifting apart.

// Callers must pass already-lowercased title/description.
export function isEroticContent(title: string, description: string): boolean {
  const eroticKeywords = [
    'erotic', 'porn', 'sex', 'nude',
    'nudity', 'explicit', 'mature', 'softcore',
    'hardcore', 'xxx', 'erotica', 'sensual',
    'intimate', 'romance novel', 'adult romance',
    'mature film', 'adult cinema', 'adult film', 'adult movie',
    'sultry', 'seduct', 'seduce', 'kinky', 'flirt', 'lude'
  ];

  const hasEroticContent = eroticKeywords.some(keyword =>
    description.includes(keyword) || title.includes(keyword)
  );

  const hasEroticTitle = eroticKeywords.some(keyword =>
    title.includes(keyword)
  );

  return hasEroticContent || hasEroticTitle;
}

export function meetsQualityStandards(rating: number, voteCount: number): boolean {
  // Must have rating >= 6.0
  if (rating < 6.0) return false;

  // Must have at least 10 votes to ensure rating reliability
  if (voteCount < 10) return false;

  return true;
}
