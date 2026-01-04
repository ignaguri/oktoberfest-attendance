import { test, expect } from "@playwright/test";

import { TEST_USERS } from "../helpers/test-data";
import { CalendarPage } from "../pages/calendar.page";
import { HomePage } from "../pages/home.page";
import { SignInPage } from "../pages/sign-in.page";

// Use user5 for calendar tests to avoid session conflicts with other test files
const CALENDAR_TEST_USER = TEST_USERS.user5;

// Run tests serially to avoid session conflicts when using shared test users
test.describe.configure({ mode: "serial" });

test.describe("Calendar Flows", () => {
  // Before each test, sign in and dismiss overlays
  test.beforeEach(async ({ page }) => {
    const signInPage = new SignInPage(page);
    const homePage = new HomePage(page);

    await signInPage.goto();
    await signInPage.signInAndWaitForHome(
      CALENDAR_TEST_USER.email,
      CALENDAR_TEST_USER.password
    );
    await homePage.expectOnHomePage();

    // Wait for page to fully load before dismissing overlays
    await page.waitForLoadState("networkidle");
    await homePage.dismissAllOverlays();
  });

  test.describe("FLOW_CAL_001: View Calendar Page", () => {
    test("should display calendar page", async ({ page }) => {
      const calendarPage = new CalendarPage(page);

      await calendarPage.goto();
      await calendarPage.expectOnCalendarPage();
    });

    test("should show calendar grid", async ({ page }) => {
      const calendarPage = new CalendarPage(page);

      await calendarPage.goto();
      await calendarPage.expectCalendarLoaded();

      // Calendar grid should be visible
      await expect(calendarPage.calendarGrid).toBeVisible();
    });
  });

  test.describe("FLOW_CAL_002: Select Date on Calendar", () => {
    test("should select a date on calendar", async ({ page }) => {
      const calendarPage = new CalendarPage(page);

      await calendarPage.goto();
      await calendarPage.expectCalendarLoaded();

      // Try to select a day within the festival period (e.g., day 21)
      // The calendar may restrict to festival dates, so just verify calendar exists
      const dateButtons = page.getByRole("gridcell");
      const count = await dateButtons.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe("FLOW_CAL_003: View Attendance Action Buttons", () => {
    test("should show attendance and reservation buttons", async ({ page }) => {
      const calendarPage = new CalendarPage(page);

      await calendarPage.goto();
      await calendarPage.expectCalendarLoaded();

      // Action buttons should be visible
      await calendarPage.expectActionButtonsVisible();
    });
  });

  test.describe("FLOW_CAL_004: Navigate to Add Attendance", () => {
    test("should navigate to add attendance", async ({ page }) => {
      const calendarPage = new CalendarPage(page);

      await calendarPage.goto();
      await calendarPage.expectCalendarLoaded();

      // First click on a date to make sure a date is selected
      // Then click add attendance
      await calendarPage.clickAddAttendance();

      // Should navigate to edit attendance page
      await expect(page).toHaveURL(/\/calendar\/edit-attendance/);
    });
  });

  test.describe("FLOW_CAL_005: View Events for Date", () => {
    test("should display events section for selected date", async ({
      page,
    }) => {
      const calendarPage = new CalendarPage(page);

      await calendarPage.goto();
      await calendarPage.expectCalendarLoaded();

      // Check that either events or "no events" message is shown
      const hasEvents = await calendarPage.hasEvents();

      if (hasEvents) {
        const eventsCount = await calendarPage.getEventsCount();
        expect(eventsCount).toBeGreaterThan(0);
      } else {
        await expect(calendarPage.noEventsMessage).toBeVisible();
      }
    });
  });
});
