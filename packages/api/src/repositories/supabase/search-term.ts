/**
 * Strips the wildcards PostgREST understands inside an `ilike` value (it maps
 * `*` to `%`), so a term someone typed matches literally.
 *
 * Commas, dots and parens survive on purpose. They only carry meaning inside an
 * `.or()` filter, and the callers of this helper pass the term to `.ilike()`
 * instead, where the value is never parsed as filter syntax. Interpolating a
 * raw term into `.or()` is what made a name like "Muller, Anna" split the
 * filter into malformed fragments and 400 the whole search.
 *
 * admin.repository.ts keeps its own stricter version: that one also has to feed
 * a length cap and an email comparison, so its trade-offs are different.
 */
export function stripSearchWildcards(term: string): string {
  return term.replace(/[%_*\\]/g, "");
}
