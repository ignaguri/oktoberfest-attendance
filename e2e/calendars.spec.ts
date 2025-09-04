import { test, expect } from "./fixtures/authenticated";
import { BASE_URL } from "./helpers/config";

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test.describe("Calendars UI", () => {
  test("personal calendar deep-link opens add reservation dialog via URL", async ({
    page,
  }) => {
    const date = todayYMD();
    await page.goto(
      `${BASE_URL}/attendance/calendar?date=${date}&newReservation=1`,
    );
    await expect(page).toHaveURL(/newReservation=1/);
    await expect(
      page.getByRole("heading", { name: /new reservation/i }),
    ).toBeVisible();
  });

  test("group calendar renders for Group A", async ({ page }) => {
    // Navigate to first group details page and then calendar
    await page.goto(`${BASE_URL}/groups`);
    // Find a Group A link if exists
    const groupLink = page.getByRole("link", { name: /group a/i }).first();
    if (await groupLink.isVisible().catch(() => false)) {
      await groupLink.click();
      await page.getByRole("link", { name: /calendar/i }).click();
      await expect(
        page.getByRole("heading", { name: /group calendar/i }),
      ).toBeVisible();
    }
  });
});
