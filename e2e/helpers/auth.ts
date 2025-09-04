import type { Page } from "@playwright/test";

import { BASE_URL, SEEDED_CREDENTIALS } from "./config";

export async function loginAsSeededUser(
  page: Page,
  email: string = SEEDED_CREDENTIALS.email,
  password: string = SEEDED_CREDENTIALS.password,
) {
  await page.goto(`${BASE_URL}/`);
  // If already logged in, skip
  const maybeSignedOut = await page
    .getByRole("button", { name: /sign out/i })
    .isVisible()
    .catch(() => false);
  if (maybeSignedOut) return;

  await page.goto(`${BASE_URL}/sign-in`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/home|\/$/);
}
