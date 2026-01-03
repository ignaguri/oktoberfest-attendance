/**
 * Test data constants for E2E tests.
 * These match the seeded data in supabase/seed.sql
 */

import { addDays, format } from "date-fns";

/**
 * Seeded test users (user1-10@example.com, password: "password")
 */
export const TEST_USERS = {
  user1: { email: "user1@example.com", password: "password" },
  user2: { email: "user2@example.com", password: "password" },
  user3: { email: "user3@example.com", password: "password" },
  user4: { email: "user4@example.com", password: "password" },
  user5: { email: "user5@example.com", password: "password" },
  user6: { email: "user6@example.com", password: "password" },
  user7: { email: "user7@example.com", password: "password" },
  user8: { email: "user8@example.com", password: "password" },
  user9: { email: "user9@example.com", password: "password" }, // Default test user
  user10: { email: "user10@example.com", password: "password" },
} as const;

/**
 * Default test user for most tests
 */
export const DEFAULT_TEST_USER = TEST_USERS.user9;

/**
 * Seeded test groups with their passwords
 * Group names are "Group A", "Group B", "Group C"
 * Passwords are "passwordA", "passwordB", "passwordC"
 */
export const TEST_GROUPS = {
  groupA: { name: "Group A", password: "passwordA" },
  groupB: { name: "Group B", password: "passwordB" },
  groupC: { name: "Group C", password: "passwordC" },
} as const;

/**
 * Sample tent IDs from seed data (for testing tent selection)
 */
export const TEST_TENTS = {
  hofbrau: {
    id: "253eb29d-8efe-4095-9671-4eff02704c4a",
    name: "Hofbräu-Festzelt",
    category: "large",
  },
  augustiner: {
    id: "631abb99-4237-4bbc-94d7-2a6c18e11e25",
    name: "Augustiner-Festhalle",
    category: "large",
  },
  schottenhamel: {
    id: "9eb72005-8026-4665-be77-4a61fbcc3fa1",
    name: "Festhalle Schottenhamel",
    category: "large",
  },
  paulaner: {
    id: "0935a117-4fe2-46fb-b8fa-fc45d9496af9",
    name: "Paulaner Festzelt",
    category: "large",
  },
} as const;

/**
 * Invalid credentials for error testing
 */
export const INVALID_CREDENTIALS = {
  email: "nonexistent@example.com",
  password: "wrongpassword",
} as const;

/**
 * Generate a unique group name for test isolation
 */
export function generateUniqueGroupName(prefix = "E2E Test Group"): string {
  return `${prefix} ${Date.now()}`;
}

/**
 * Generate a unique email for user creation tests
 */
export function generateUniqueEmail(prefix = "e2e-test"): string {
  return `${prefix}-${Date.now()}@example.com`;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayYMD(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Get a date offset from today in YYYY-MM-DD format
 */
export function getDateOffsetYMD(daysOffset: number): string {
  return format(addDays(new Date(), daysOffset), "yyyy-MM-dd");
}
