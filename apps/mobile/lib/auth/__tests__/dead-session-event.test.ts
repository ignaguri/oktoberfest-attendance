import { describe, expect, it, vi } from "vitest";

// AuthContext.tsx pulls in several native-only modules (react-native, expo-*,
// @sentry/react-native, vexo-analytics) transitively. Mock them out so the
// module can be imported in a plain node test environment to exercise the
// pure `isDeadSessionSignOut` helper.
vi.mock("@sentry/react-native", () => ({
  captureMessage: vi.fn(),
  setUser: vi.fn(),
}));
vi.mock("vexo-analytics", () => ({
  identifyDevice: vi.fn(),
}));
vi.mock("@/lib/database/debug", () => ({
  clearAllData: vi.fn(),
}));
vi.mock("@/lib/database/init", () => ({
  getDatabase: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { onAuthStateChange: vi.fn(), getSession: vi.fn(), signOut: vi.fn() } },
}));
vi.mock("../oauth", () => ({
  signInWithApple: vi.fn(),
  signInWithFacebook: vi.fn(),
  signInWithGoogle: vi.fn(),
}));
vi.mock("../secure-storage", () => ({
  clearAllAuthData: vi.fn(),
  clearSession: vi.fn(),
  getStoredSession: vi.fn(),
  storeSession: vi.fn(),
  storeUserEmail: vi.fn(),
}));

import { isDeadSessionSignOut } from "../AuthContext";

describe("isDeadSessionSignOut", () => {
  it("is true for a library-driven SIGNED_OUT (not user-initiated)", () => {
    expect(isDeadSessionSignOut("SIGNED_OUT", false)).toBe(true);
  });
  it("is false when the user initiated the sign-out", () => {
    expect(isDeadSessionSignOut("SIGNED_OUT", true)).toBe(false);
  });
  it("is false for non-sign-out events", () => {
    expect(isDeadSessionSignOut("TOKEN_REFRESHED", false)).toBe(false);
    expect(isDeadSessionSignOut("SIGNED_IN", false)).toBe(false);
  });
});
