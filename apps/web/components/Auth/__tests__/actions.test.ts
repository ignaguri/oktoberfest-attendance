import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const signInWithPassword = vi.fn();
const signUpFn = vi.fn();
const resetPasswordForEmail = vi.fn();

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword,
      signUp: signUpFn,
      resetPasswordForEmail,
    },
  })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT" });
  }),
}));
vi.mock("@/utils/sentry", () => ({
  INVALID_CREDENTIALS_MESSAGE: "Invalid email or password",
  CAPTCHA_REJECTED_MESSAGE: "Captcha verification failed",
  reportSupabaseAuthException: vi.fn(),
}));

import { login, resetPassword, signUp } from "../actions";

describe("auth actions forward the captcha token", () => {
  beforeEach(() => {
    signInWithPassword.mockReset().mockResolvedValue({ error: null });
    signUpFn.mockReset().mockResolvedValue({ error: null });
    resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
  });

  it("login passes captchaToken in options", async () => {
    await login({ email: "a@b.com", password: "pw" }, null, "tok-1").catch(() => {});

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "pw",
      options: { captchaToken: "tok-1" },
    });
  });

  it("signUp passes captchaToken in options", async () => {
    await signUp({ email: "a@b.com", password: "pw" }, "tok-2");

    expect(signUpFn).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "pw",
      options: { captchaToken: "tok-2" },
    });
  });

  it("resetPassword passes captchaToken in options", async () => {
    await resetPassword({ email: "a@b.com" }, "tok-3");

    expect(resetPasswordForEmail).toHaveBeenCalledWith("a@b.com", {
      captchaToken: "tok-3",
    });
  });

  it("omits options entirely when no token is supplied", async () => {
    await signUp({ email: "a@b.com", password: "pw" });

    expect(signUpFn).toHaveBeenCalledWith({ email: "a@b.com", password: "pw" });

    // toHaveBeenCalledWith treats a key holding `undefined` as absent, so the
    // assertion above would also pass for `{ options: undefined }`. Pin the exact
    // key set, which is what keeps the no-token call byte-identical to the
    // pre-captcha call.
    expect(Object.keys(signUpFn.mock.calls[0][0])).toEqual(["email", "password"]);
  });
});
