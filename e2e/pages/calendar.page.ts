import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

import type { Locator, Page } from "@playwright/test";

/**
 * Page object for the Calendar page (/calendar)
 * Handles viewing personal calendar with events.
 */
export class CalendarPage extends BasePage {
  readonly path = "/calendar";

  // Page heading
  readonly pageHeading: Locator;

  // Calendar elements
  readonly calendarCard: Locator;
  readonly calendarGrid: Locator;

  // Action buttons
  readonly addAttendanceButton: Locator;
  readonly addReservationButton: Locator;

  // Events section
  readonly noEventsMessage: Locator;
  readonly eventItems: Locator;

  // Loading
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);

    // Page heading
    this.pageHeading = page.getByRole("heading", { name: "My Calendar" });

    // Calendar elements - the calendar is inside a card
    this.calendarCard = page.locator("[class*='card']").first();
    this.calendarGrid = page.getByRole("grid");

    // Action buttons
    this.addAttendanceButton = page.getByRole("button", {
      name: /\+attendance/i,
    });
    this.addReservationButton = page.getByRole("button", {
      name: /\+reservation/i,
    });

    // Events section
    this.noEventsMessage = page.getByText(/no events/i);
    this.eventItems = page.locator("[class*='rounded-md'][class*='p-2']");

    // Loading spinner
    this.loadingSpinner = page.locator("[class*='animate-spin']");
  }

  /**
   * Assert that we're on the calendar page
   */
  async expectOnCalendarPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/calendar/);
    await expect(this.pageHeading).toBeVisible();
  }

  /**
   * Wait for calendar to finish loading
   */
  async waitForLoad(): Promise<void> {
    // Wait for spinner to disappear if present
    try {
      await this.loadingSpinner.waitFor({ state: "hidden", timeout: 10000 });
    } catch {
      // Spinner may not appear if data loads quickly
    }
    // Wait for calendar grid to be visible
    await expect(this.calendarGrid).toBeVisible({ timeout: 10000 });
  }

  /**
   * Assert that the calendar page is fully loaded
   */
  async expectCalendarLoaded(): Promise<void> {
    await this.expectOnCalendarPage();
    await this.waitForLoad();
    await expect(this.calendarGrid).toBeVisible();
  }

  /**
   * Check if action buttons are visible
   */
  async expectActionButtonsVisible(): Promise<void> {
    await expect(this.addAttendanceButton).toBeVisible();
    await expect(this.addReservationButton).toBeVisible();
  }

  /**
   * Click on a date in the calendar
   */
  async selectDate(day: number): Promise<void> {
    // Find the gridcell button for the specific day
    const dayButton = this.page.getByRole("gridcell", {
      name: new RegExp(`^${day}$`),
    });
    await dayButton.click();
  }

  /**
   * Click add attendance button
   */
  async clickAddAttendance(): Promise<void> {
    await this.addAttendanceButton.click();
  }

  /**
   * Click add reservation button
   */
  async clickAddReservation(): Promise<void> {
    await this.addReservationButton.click();
  }

  /**
   * Get the selected date text from footer
   */
  async getSelectedDateText(): Promise<string> {
    // The date is displayed as a text like "September 21, 2024"
    const dateContainer = this.page.locator(
      "[class*='CardFooter'] .text-xs.font-medium"
    );
    return (await dateContainer.textContent()) || "";
  }

  /**
   * Check if there are events for the selected date
   */
  async hasEvents(): Promise<boolean> {
    const noEventsVisible = await this.noEventsMessage.isVisible().catch(() => false);
    return !noEventsVisible;
  }

  /**
   * Get count of events displayed
   */
  async getEventsCount(): Promise<number> {
    return await this.eventItems.count();
  }

  /**
   * Check if beer summary event is displayed
   */
  async hasBeerSummary(): Promise<boolean> {
    return await this.page
      .getByText(/daily total/i)
      .isVisible()
      .catch(() => false);
  }
}
