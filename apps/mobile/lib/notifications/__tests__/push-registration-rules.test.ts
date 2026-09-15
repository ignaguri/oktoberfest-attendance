import { describe, expect, it } from "vitest";

import {
  shouldShowFestivalAlertCard,
  shouldSyncPushRegistration,
} from "../push-registration-rules";

const syncReady = {
  isAuthenticated: true,
  isPermissionLoading: false,
  permissionStatus: "granted" as const,
  alreadySynced: false,
  isWeb: false,
  userId: "user-1",
  lastAttemptedUserId: null as string | null,
};

describe("shouldSyncPushRegistration", () => {
  it("syncs a signed-in native user who granted permission and never synced", () => {
    expect(shouldSyncPushRegistration(syncReady)).toBe(true);
  });

  it("does not sync twice", () => {
    expect(shouldSyncPushRegistration({ ...syncReady, alreadySynced: true })).toBe(false);
  });

  it("waits for auth and permission state, and skips without permission or on web", () => {
    expect(shouldSyncPushRegistration({ ...syncReady, isAuthenticated: false })).toBe(false);
    expect(shouldSyncPushRegistration({ ...syncReady, isPermissionLoading: true })).toBe(false);
    expect(shouldSyncPushRegistration({ ...syncReady, permissionStatus: "undetermined" })).toBe(
      false,
    );
    expect(shouldSyncPushRegistration({ ...syncReady, permissionStatus: "denied" })).toBe(false);
    expect(shouldSyncPushRegistration({ ...syncReady, isWeb: true })).toBe(false);
  });

  it("does not attempt when there is no signed-in user", () => {
    expect(shouldSyncPushRegistration({ ...syncReady, userId: null })).toBe(false);
  });

  it("does not re-attempt for the same user it already attempted", () => {
    expect(
      shouldSyncPushRegistration({ ...syncReady, lastAttemptedUserId: syncReady.userId }),
    ).toBe(false);
  });

  it("attempts again for a different user than the last one attempted", () => {
    expect(shouldSyncPushRegistration({ ...syncReady, lastAttemptedUserId: "user-0" })).toBe(true);
  });
});

const cardReady = {
  phase: "upcoming" as const,
  permissionStatus: "undetermined" as const,
  isPermissionLoading: false,
  dismissed: false,
  isWeb: false,
};

describe("shouldShowFestivalAlertCard", () => {
  it("shows before and during the festival when permission is missing", () => {
    expect(shouldShowFestivalAlertCard(cardReady)).toBe(true);
    expect(shouldShowFestivalAlertCard({ ...cardReady, phase: "live" })).toBe(true);
    expect(shouldShowFestivalAlertCard({ ...cardReady, permissionStatus: "denied" })).toBe(true);
  });

  it("hides when granted, dismissed, loading, ended, unknown or on web", () => {
    expect(shouldShowFestivalAlertCard({ ...cardReady, permissionStatus: "granted" })).toBe(false);
    expect(shouldShowFestivalAlertCard({ ...cardReady, dismissed: true })).toBe(false);
    expect(shouldShowFestivalAlertCard({ ...cardReady, isPermissionLoading: true })).toBe(false);
    expect(shouldShowFestivalAlertCard({ ...cardReady, phase: "ended" })).toBe(false);
    expect(shouldShowFestivalAlertCard({ ...cardReady, phase: null })).toBe(false);
    expect(shouldShowFestivalAlertCard({ ...cardReady, isWeb: true })).toBe(false);
  });
});
