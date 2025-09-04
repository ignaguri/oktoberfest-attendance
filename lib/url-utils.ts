/**
 * Utility functions for URL and search parameter manipulation
 */

/**
 * Removes specified search parameters from URLSearchParams and returns the updated string
 *
 * @param searchParams - The current URLSearchParams object
 * @param paramsToRemove - Array of parameter names to remove
 * @returns Updated search parameters as a string
 *
 * @example
 * ```ts
 * const searchParams = new URLSearchParams('?a=1&b=2&c=3');
 * const updated = removeSearchParams(searchParams, ['a', 'c']);
 * // Returns: "b=2"
 * ```
 */
export function removeSearchParams(
  searchParams: URLSearchParams,
  paramsToRemove: string[],
): string {
  const newSearchParams = new URLSearchParams(searchParams);
  paramsToRemove.forEach((param) => newSearchParams.delete(param));
  return newSearchParams.toString();
}

/**
 * Creates a URL with updated search parameters
 *
 * @param basePath - The base path (e.g., '/attendance')
 * @param searchParams - The current URLSearchParams object
 * @param paramsToRemove - Array of parameter names to remove
 * @returns Complete URL with updated search parameters
 *
 * @example
 * ```ts
 * const searchParams = new URLSearchParams('?a=1&b=2&c=3');
 * const url = createUrlWithParams('/attendance', searchParams, ['a', 'c']);
 * // Returns: "/attendance?b=2"
 * ```
 */
export function createUrlWithParams(
  basePath: string,
  searchParams: URLSearchParams,
  paramsToRemove: string[],
): string {
  const updatedParams = removeSearchParams(searchParams, paramsToRemove);
  return updatedParams ? `${basePath}?${updatedParams}` : basePath;
}
