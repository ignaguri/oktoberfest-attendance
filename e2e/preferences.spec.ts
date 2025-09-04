import { test, expect } from "./fixtures/authenticated";
import { BASE_URL } from "./helpers/config";

test.describe("Notification preferences", () => {
  test("toggle reminders, achievement and group notifications", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/profile`);
    await expect(
      page.getByRole("heading", { name: /notification/i }),
    ).toBeVisible();

    // Reminders toggle
    const reminders = page.getByRole("switch", { name: /reminders/i });
    const initialReminders = await reminders.getAttribute("aria-checked");
    await reminders.click();
    await expect(reminders).toHaveAttribute(
      "aria-checked",
      initialReminders === "true" ? "false" : "true",
    );

    // Achievement notifications toggle
    const achievement = page.getByRole("switch", { name: /achievement/i });
    const initialAchievement = await achievement.getAttribute("aria-checked");
    await achievement.click();
    await expect(achievement).toHaveAttribute(
      "aria-checked",
      initialAchievement === "true" ? "false" : "true",
    );

    // Group notifications toggle
    const group = page.getByRole("switch", { name: /group notifications/i });
    const initialGroup = await group.getAttribute("aria-checked");
    await group.click();
    await expect(group).toHaveAttribute(
      "aria-checked",
      initialGroup === "true" ? "false" : "true",
    );
  });
});
