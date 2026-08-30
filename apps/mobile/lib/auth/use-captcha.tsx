import ConfirmHcaptcha from "@hcaptcha/react-native-hcaptcha";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useCallback, useRef } from "react";

const SITEKEY = process.env.EXPO_PUBLIC_HCAPTCHA_SITEKEY ?? "";

// hCaptcha requires a URL it treats as the request origin. It is not fetched.
const BASE_URL = "https://prostcounter.fun";

/**
 * hCaptcha on React Native is a modal, not an inline widget: you show it, the
 * user solves it, and a token arrives through onMessage. This wraps that into
 * an awaitable `getToken()` so the auth screens keep a linear submit flow.
 *
 * Resolves `undefined` rather than rejecting when the user cancels. Cancelling
 * is a deliberate choice, not a failure, and the caller should abort quietly.
 */
export function useCaptcha() {
  const { i18n } = useTranslation();
  const modalRef = useRef<ConfirmHcaptcha | null>(null);
  const resolverRef = useRef<((token: string | undefined) => void) | null>(null);

  const settle = useCallback((token: string | undefined) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(token);
  }, []);

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      const data = event.nativeEvent.data;

      // 'open' fires when the challenge becomes visible; it is not a result.
      if (data === "open") {
        return;
      }

      modalRef.current?.hide();

      if (data === "cancel" || data === "error" || data === "expired") {
        settle(undefined);
        return;
      }

      settle(data);
    },
    [settle],
  );

  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (!SITEKEY) {
      return undefined;
    }

    // A previous request that never settled would leak its promise, so clear it.
    settle(undefined);

    return new Promise<string | undefined>((resolve) => {
      resolverRef.current = resolve;
      modalRef.current?.show();
    });
  }, [settle]);

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
        languageCode={i18n.language}
      />
    );
  }, [onMessage, i18n.language]);

  return { getToken, CaptchaModal, enabled: SITEKEY.length > 0 };
}
