"use client";

import { cn } from "@/lib/utils";
import * as React from "react";
import { DayPicker } from "react-day-picker";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  className?: string;
};

/**
 * Calendar component built on top of react-day-picker
 *
 * Provides a styled calendar interface with customizable appearance and behavior.
 * Supports single date selection, range selection, and various display modes.
 *
 * @param className - Optional CSS class name for custom styling
 * @param props - All props from react-day-picker's DayPicker component
 * @returns A styled calendar component
 *
 * @example
 * ```tsx
 * <Calendar
 *   mode="single"
 *   selected={selectedDate}
 *   onSelect={setSelectedDate}
 *   className="w-fit"
 * />
 * ```
 */
export function Calendar({ className, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button:
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground",
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative",
        day_button: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-30 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
      }}
      {...props}
    />
  );
}
