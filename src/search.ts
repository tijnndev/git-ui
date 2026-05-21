/** Normalize for repo search: ignore case, hyphens, underscores, and spaces. */
export function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/[-_\s]+/g, "");
}

export function matchesSearch(text: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  return normalizeSearchText(text).includes(normalizeSearchText(q));
}
