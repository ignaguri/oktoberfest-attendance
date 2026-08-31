import ConfirmHcaptcha from "@hcaptcha/react-native-hcaptcha";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useCallback, useEffect, useRef } from "react";

const SITEKEY = process.env.EXPO_PUBLIC_HCAPTCHA_SITEKEY ?? "";

// hCaptcha requires a URL it treats as the request origin. It is not fetched.
const BASE_URL = "https://prostcounter.fun";

/**
 * The outcome of one challenge.
 *
 * Cancelling and failing are indistinguishable at the transport level (neither
 * produces a token) but mean opposite things to the user: a cancel is a
 * deliberate choice and must abort quietly, a failure needs to say so. Callers
 * that cannot tell them apart end up showing nothing at all when the challenge
 * fails to load, which looks like a dead button.
 */
export type CaptchaResult =
  | { status: "disabled" }
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
 * hCaptcha on React Native is a modal, not an inline widget: you show it, the
 * user solves it, and a token arrives through onMessage. This wraps that into
 * an awaitable `getToken()` so the auth screens keep a linear submit flow.
 */
export function useCaptcha() {
  const { i18n } = useTranslation();
  const modalRef = useRef<ConfirmHcaptcha | null>(null);
  const resolverRef = useRef<((result: CaptchaResult) => void) | null>(null);

  // Read at render time by CaptchaModal instead of being a useCallback
  // dependency. As a dependency it would hand React a new function identity on
  // every language change, which React reads as a different component type: it
  // would unmount the modal mid-challenge and strand the pending promise.
  const languageRef = useRef(i18n.language);
  languageRef.current = i18n.language;

  const settle = useCallback((result: CaptchaResult) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(result);
  }, []);

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string }; success?: boolean }) => {
      const data = event.nativeEvent.data;

      // 'open' fires when the challenge becomes visible; it is not a result.
      if (data === "open") {
        return;
      }

      modalRef.current?.hide();

      // Never classify by matching known strings. The library forwards plenty
      // of non-token payloads through this same channel: 'challenge-closed',
      // 'script-error', 'sms-open-failed', raw hCaptcha error codes such as
      // 'rate-limited' or 'network-error', and even a bare exception name when
      // the render throws. Anything unrecognised would otherwise be handed to
      // GoTrue as a token, which fails and then reads as a wrong password.
      //
      // The library has already done this classification for us: it sets
      // success=false on every event that is neither 'open' nor token-shaped
      // (its own test is `data.length > 35`). Its type declares success as
      // required, but the two cancel events it raises directly omit the field,
      // so this tests for true rather than for falsiness.
      if (event.success === true) {
        settle({ status: "token", token: data });
        return;
      }

      settle({ status: CANCEL_EVENTS.has(data) ? "cancelled" : "error" });
    },
    [settle],
  );

  const getToken = useCallback(async (): Promise<CaptchaResult> => {
    if (!SITEKEY) {
      return { status: "disabled" };
    }

    // A previous request that never settled would leak its promise, so clear it.
    settle({ status: "cancelled" });

    return new Promise<CaptchaResult>((resolve) => {
      // Deliberately not optional-chained. `modalRef.current?.show()` would
      // silently do nothing while the promise stayed pending forever, leaving
      // the submit button spinning with no error and no way to retry.
      if (!modalRef.current) {
        resolve({ status: "error" });
        return;
      }

      resolverRef.current = resolve;
      modalRef.current.show();
    });
  }, [settle]);

  // A challenge still in flight when the screen goes away must not leave its
  // caller awaiting a promise that nothing can settle any more.
  useEffect(() => () => settle({ status: "cancelled" }), [settle]);

  const CaptchaModal = useCallback(() => {
    if (!SITEKEY) {
      return null;
    }

    return (
      <ConfirmHcaptcha
        ref={modalRef}
        siteKey={SITEKEY}
        baseUrl={BASE_URL}
        onMessage={onMessage}
        // Restates the library's own documented default (README: "The UI
        // defaults to the 'invisible' mode"). Only spelled out here because
        // the shipped .d.ts marks `size` as required despite that default;
        // this is not a deliberate UX choice, so do not change it lightly.
        size="invisible"
        // The audience is substantially German-speaking; an English-only
        // challenge mid-signup would be a regression against the app's i18n.
        languageCode={languageRef.current}
      />
    );
  }, [onMessage]);

  return { getToken, CaptchaModal, enabled: SITEKEY.length > 0 };
}
