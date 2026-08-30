// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resetCaptcha = vi.fn();

vi.mock("@hcaptcha/react-hcaptcha", () => ({
  default: () => null,
}));

import { useCaptcha } from "../Captcha";

describe("useCaptcha", () => {
  beforeEach(() => {
    resetCaptcha.mockClear();
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
    const { result } = renderHook(() => useCaptcha());
    act(() => result.current.setToken("tok-1"));

    // Stand in for the mounted hCaptcha instance.
    result.current.captchaRef.current = { resetCaptcha } as never;

    act(() => result.current.reset());

    expect(result.current.token).toBeUndefined();
    expect(resetCaptcha).toHaveBeenCalledOnce();
  });

  it("reports disabled when no sitekey is configured", () => {
    const { result } = renderHook(() => useCaptcha());
    // No NEXT_PUBLIC_HCAPTCHA_SITEKEY is set in the test environment.
    expect(result.current.enabled).toBe(false);
  });
});
