"use client";

import HCaptcha from "@hcaptcha/react-hcaptcha";
import { type RefObject, useCallback, useRef, useState } from "react";

const SITEKEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY ?? "";

type CaptchaRef = RefObject<HCaptcha | null>;

/**
 * Shared captcha state for the three auth forms.
 *
 * hCaptcha tokens are single-use and expire after roughly two minutes, so a
 * token that has been spent (or aged out while the user fixed a typo) is
 * rejected. Every error path must call `reset()` before the user can retry,
 * otherwise the second submit fails with a captcha error unrelated to whatever
 * the user actually typed, and the form looks broken.
 */
export function useCaptcha() {
  const captchaRef = useRef<HCaptcha | null>(null);
  const [token, setTokenState] = useState<string | undefined>(undefined);

  const setToken = useCallback((next: string | undefined) => {
    setTokenState(next);
  }, []);

  const reset = useCallback(() => {
    setTokenState(undefined);
    captchaRef.current?.resetCaptcha();
  }, []);

  return {
    captchaRef: captchaRef as CaptchaRef,
    token,
    setToken,
    reset,
    enabled: SITEKEY.length > 0,
  };
}

interface CaptchaWidgetProps {
  captchaRef: CaptchaRef;
  onVerify: (token: string) => void;
  onExpire: () => void;
}

/**
 * Renders nothing when no sitekey is configured, which keeps local development
 * and any unconfigured environment working. Enforcement lives in Supabase, not
 * here, so an absent key must not be a client-side hard failure.
 */
export function CaptchaWidget({ captchaRef, onVerify, onExpire }: CaptchaWidgetProps) {
  if (!SITEKEY) {
    return null;
  }

  return (
    <div className="flex w-full justify-center">
      <HCaptcha ref={captchaRef} sitekey={SITEKEY} onVerify={onVerify} onExpire={onExpire} />
    </div>
  );
}
