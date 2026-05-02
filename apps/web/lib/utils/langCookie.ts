const COOKIE_NAME = "lang";
const MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export function getLangCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setLangCookie(lang: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(lang)};path=/;max-age=${MAX_AGE};SameSite=Lax`;
}
