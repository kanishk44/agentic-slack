/** Matches `@handle` mentions. Handles are lowercase slugs: letters, digits, `-`, `_`. */
export const MENTION_REGEX = /(^|[^\w@])@([a-z0-9][a-z0-9_-]{0,31})\b/gi;

/** Returns unique, lowercased handles mentioned in a message body. */
export function extractHandles(content: string): string[] {
  const handles = new Set<string>();
  for (const match of content.matchAll(MENTION_REGEX)) {
    handles.add(match[2].toLowerCase());
  }
  return [...handles];
}

/** Converts a display name into a handle slug, e.g. "Frontend Expert" -> "frontend-expert". */
export function toHandle(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}
