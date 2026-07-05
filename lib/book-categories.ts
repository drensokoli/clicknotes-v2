// Google Books' `categories` often combines a top-level BISAC category and a
// subcategory into one string, e.g. "Biography & Autobiography / General" -
// split those into separate genre-like tags instead of one long combined pill.
export function splitBookCategories(categories?: string[]): string[] {
  const result = new Set<string>()
  for (const category of categories ?? []) {
    for (const part of category.split("/")) {
      const trimmed = part.trim()
      if (trimmed) result.add(trimmed)
    }
  }
  return Array.from(result)
}
