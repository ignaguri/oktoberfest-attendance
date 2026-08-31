/**
 * Classification of the messages @hcaptcha/react-native-hcaptcha posts through
 * its onMessage prop.
 *
 * Kept separate from the hook so it can be tested directly: this is the part
 * that decides whether a payload becomes a token sent to Supabase, and getting
 * it wrong sends garbage to GoTrue.
 */

/** The outcome of one challenge, as seen by a caller of `getToken()`. */
export type CaptchaResult =
  | { status: "disabled" }
  | { status: "token"; token: string }
  | { status: "cancelled" }
  | { status: "error" };

/** A single onMessage event, plus 'pending' for events that are not a result. */
export type CaptchaOutcome =
  | { status: "pending" }
  | { status: "token"; token: string }
  | { status: "cancelled" }
  | { status: "error" };

/**
 * The two cancel paths. `cancel` is raised by the library itself for a backdrop
 * press or hardware back; `challenge-closed` comes from hCaptcha's own close
 * button inside the WebView, and is the one users actually hit.
 */
const CANCEL_EVENTS = new Set(["cancel", "challenge-closed"]);

/**
 * Never classify by matching known strings. The library forwards plenty of
 * non-token payloads through the same channel: 'challenge-closed',
 * 'script-error', 'sms-open-failed', raw hCaptcha error codes such as
 * 'rate-limited' or 'network-error', and even a bare exception name when the
 * render throws. Treating anything unrecognised as a token hands GoTrue a
 * string that fails verification, which then surfaces to the user as a
 * captcha rejection on an app that is perfectly up to date.
 *
 * The library has already done this classification for us: it sets
 * success=false on every event that is neither 'open' nor token-shaped (its
 * own test is `data.length > 35`). Its type declares success as required, but
 * the two cancel events it raises directly omit the field, so this tests for
 * `true` rather than for falsiness.
 */
export function classifyCaptchaEvent(data: string, success?: boolean): CaptchaOutcome {
  // 'open' fires when the challenge becomes visible; it is not a result.
  if (data === "open") {
    return { status: "pending" };
  }

  if (success === true) {
    return { status: "token", token: data };
  }

  return { status: CANCEL_EVENTS.has(data) ? "cancelled" : "error" };
}
