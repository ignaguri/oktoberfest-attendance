import { beforeEach, describe, expect, it, vi } from "vitest";

const { signInAsync, signInWithIdToken, profileGet, profileUpdate, loggerError } = vi.hoisted(
  () => ({
    signInAsync: vi.fn(),
    signInWithIdToken: vi.fn(),
    profileGet: vi.fn(),
    profileUpdate: vi.fn(),
    loggerError: vi.fn(),
  }),
);

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-apple-authentication", () => ({
  signInAsync,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
vi.mock("expo-auth-session", () => ({ makeRedirectUri: vi.fn(() => "prostcounter://") }));
vi.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { signInWithIdToken, signInWithOAuth: vi.fn(), setSession: vi.fn() } },
}));
vi.mock("@/lib/api-client", () => ({
  apiClient: { profile: { get: profileGet, update: profileUpdate } },
}));
vi.mock("@/lib/logger", () => ({ logger: { error: loggerError } }));

import { signInWithApple } from "../oauth";

const credential = (fullName: Record<string, string | null> | null) => ({
  identityToken: "id-token",
  fullName,
});

describe("signInWithApple full name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithIdToken.mockResolvedValue({ error: null });
    profileGet.mockResolvedValue({ profile: { full_name: null } });
    profileUpdate.mockResolvedValue({});
  });

  it("saves the name Apple returns onto a profile that has none", async () => {
    signInAsync.mockResolvedValue(credential({ givenName: "Jane", familyName: "Doe" }));

    const { error } = await signInWithApple();

    expect(error).toBeNull();
    expect(profileUpdate).toHaveBeenCalledWith({ full_name: "Jane Doe" });
  });

  it("uses a single name when only one part is provided", async () => {
    signInAsync.mockResolvedValue(credential({ givenName: "Jane", familyName: null }));

    await signInWithApple();

    expect(profileUpdate).toHaveBeenCalledWith({ full_name: "Jane" });
  });

  it("does nothing when Apple returns no name (repeat sign-in)", async () => {
    signInAsync.mockResolvedValue(credential(null));

    await signInWithApple();

    expect(profileGet).not.toHaveBeenCalled();
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it("does not overwrite a name the profile already has", async () => {
    profileGet.mockResolvedValue({ profile: { full_name: "Edited Name" } });
    signInAsync.mockResolvedValue(credential({ givenName: "Jane", familyName: "Doe" }));

    await signInWithApple();

    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it("still signs in when saving the name fails", async () => {
    profileUpdate.mockRejectedValue(new Error("boom"));
    signInAsync.mockResolvedValue(credential({ givenName: "Jane", familyName: "Doe" }));

    const { error } = await signInWithApple();

    expect(error).toBeNull();
    expect(loggerError).toHaveBeenCalled();
  });

  it("does not save a name when the Supabase sign-in fails", async () => {
    signInWithIdToken.mockResolvedValue({ error: new Error("rejected") });
    signInAsync.mockResolvedValue(credential({ givenName: "Jane", familyName: "Doe" }));

    const { error } = await signInWithApple();

    expect(error).toBeInstanceOf(Error);
    expect(profileGet).not.toHaveBeenCalled();
    expect(profileUpdate).not.toHaveBeenCalled();
  });
});
