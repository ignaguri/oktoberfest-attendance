/**
 * Splits a full name into firstName + lastName on the first whitespace.
 * Both parts are optional — if the full name is empty, undefined, or a single
 * word, the absent fields are omitted so the result can be spread into
 * Novu subscriber payloads that reject `undefined` values.
 */
export function splitFullName(fullName?: string | null): {
  firstName?: string;
  lastName?: string;
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  const [firstName, ...rest] = parts;
  const lastName = rest.join(" ");
  return lastName ? { firstName, lastName } : { firstName };
}
