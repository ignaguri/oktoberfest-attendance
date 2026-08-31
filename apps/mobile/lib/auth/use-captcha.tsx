import ConfirmHcaptcha from "@hcaptcha/react-native-hcaptcha";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useCallback, useEffect, useRef } from "react";

import { type CaptchaResult, classifyCaptchaEvent } from "./captcha-events";

const SITEKEY = process.env.EXPO_PUBLIC_HCAPTCHA_SITEKEY ?? "";

// hCaptcha requires a URL it treats as the request origin. It is not fetched.
const BASE_URL = "https://prostcounter.fun";

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
      const outcome = classifyCaptchaEvent(event.nativeEvent.data, event.success);

      // 'open' means the challenge just became visible: leave it on screen.
      if (outcome.status === "pending") {
        return;
      }

      modalRef.current?.hide();
      settle(outcome);
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
