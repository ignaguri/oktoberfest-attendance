// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@hcaptcha/react-hcaptcha", () => ({
  default: () => null,
}));

import { useCaptcha } from "../Captcha";

/**
 * `enabled` is derived from a module-scope constant, so a test that wants a
 * particular sitekey has to set the env and re-import the module. Asserting on
 * the ambient absence of NEXT_PUBLIC_HCAPTCHA_SITEKEY instead would couple this
 * file to CI configuration: the first job that exports the key so the e2e
 * captcha path works would turn this suite red.
 */
async function loadUseCaptcha(sitekey: string | undefined) {
  vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITEKEY", sitekey as string);
  vi.resetModules();
  return (await import("../Captcha")).useCaptcha;
}

describe("useCaptcha", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("starts with no token", () => {
    const { result } = renderHook(() => useCaptcha());
    expect(result.current.token).toBeUndefined();
  });

  it("holds a token once verified", () => {
    const { result } = renderHook(() => useCaptcha());
    act(() => result.current.setToken("tok-1"));
    expect(result.current.token).toBe("tok-1");
  });

  it("clears the token and resets the widget on reset", () => {
    const resetCaptcha = vi.fn();
    const { result } = renderHook(() => useCaptcha());
    act(() => result.current.setToken("tok-1"));

    // Stand in for the mounted hCaptcha instance. The component itself is
    // mocked out above, so the ref is never populated for us.
    result.current.captchaRef.current = { resetCaptcha } as never;

    act(() => result.current.reset());

    expect(result.current.token).toBeUndefined();
    expect(resetCaptcha).toHaveBeenCalledOnce();
  });

  it("reports disabled when no sitekey is configured", async () => {
    const fresh = await loadUseCaptcha("");
    const { result } = renderHook(() => fresh());
    expect(result.current.enabled).toBe(false);
  });

  it("reports enabled when a sitekey is configured", async () => {
    const fresh = await loadUseCaptcha("10000000-ffff-ffff-ffff-000000000001");
    const { result } = renderHook(() => fresh());
    expect(result.current.enabled).toBe(true);
  });
});
