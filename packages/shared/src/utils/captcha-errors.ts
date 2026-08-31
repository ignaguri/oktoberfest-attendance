/**
 * True when GoTrue rejected the request for a captcha reason.
 *
 * Matched on the substring rather than an exact code because the wording
 * varies across GoTrue versions ("captcha_failed", "captcha protection:
 * request disallowed"). The substring is the stable part.
 *
 * The practical use is telling a user on a stale app bundle to update, rather
 * than showing them a generic auth failure they cannot act on.
 */
export function isCaptchaRejection(error: { message?: string } | null | undefined): boolean {
  return (error?.message ?? "").toLowerCase().includes("captcha");
}
