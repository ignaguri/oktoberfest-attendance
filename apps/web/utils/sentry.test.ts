import type { AuthError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";

import { reportSupabaseAuthException } from "./sentry";

function authError(code: string | undefined, message = "boom"): AuthError {
  return { code, status: 400, name: "AuthApiError", message } as AuthError;
}

describe("reportSupabaseAuthException", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not report a wrong password, and does not store the typed email", () => {
    reportSupabaseAuthException("login", authError("invalid_credentials"), {
      email: "someone@example.com",
    });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.setUser).not.toHaveBeenCalled();
  });

  it.each(["email_not_confirmed", "user_already_exists", "weak_password", "same_password"])(
    "does not report the expected auth failure %s",
    (code) => {
      reportSupabaseAuthException("signUp", authError(code));

      expect(Sentry.captureException).not.toHaveBeenCalled();
    },
  );

  it("still reports unexpected auth errors", () => {
    reportSupabaseAuthException("login", authError("unexpected_failure"), {
      email: "someone@example.com",
    });

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.setUser).toHaveBeenCalledWith({ email: "someone@example.com" });
  });

  it("still reports auth errors that carry no code", () => {
    reportSupabaseAuthException("login", authError(undefined, "fetch failed"));

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
