"use client";

import { TZDate } from "@date-fns/tz";
import { TIMEZONE } from "@prostcounter/shared/constants";
import { addMonths, format as formatDateFns, subMonths } from "date-fns";
import { isAfter, isBefore } from "date-fns";
import { CalendarPlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface AttendanceDatePickerProps {
  disabled?: boolean;
  onDateChange: (date: Date | null) => void;
  value?: Date;
  festivalStartDate: Date;
  festivalEndDate: Date;
  buttonClassName?: string;
  calendarClassName?: string;
}

export function AttendanceDatePicker({
  disabled = false,
  onDateChange,
  value = new Date(),
  festivalStartDate,
  festivalEndDate,
  buttonClassName,
  calendarClassName,
}: AttendanceDatePickerProps) {
  const [open, setOpen] = useState(false);
  // Clamp the incoming value into the allowed festival range
  const clampedValue = useMemo(() => {
    if (isBefore(value, festivalStartDate)) return festivalStartDate;
    if (isAfter(value, festivalEndDate)) return festivalEndDate;
    return value;
  }, [value, festivalStartDate, festivalEndDate]);

  const selectedLabel = useMemo(() => {
    return formatDateFns(new TZDate(clampedValue, TIMEZONE), "dd/MM/yyyy");
  }, [clampedValue]);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-fit justify-between gap-2", buttonClassName)}
          disabled={disabled}
          type="button"
        >
          {selectedLabel}
          <CalendarPlusIcon className="size-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="w-auto overflow-hidden p-0">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Select date</DrawerTitle>
          <DrawerDescription>Set the date of your attendance</DrawerDescription>
        </DrawerHeader>
        <Calendar
          mode="single"
          selected={clampedValue}
          defaultMonth={clampedValue}
          captionLayout="dropdown"
          onSelect={(date) => {
            if (date) {
              onDateChange(date);
            }
            setOpen(false);
          }}
          className={cn(
            "mx-auto [--cell-size:clamp(0px,calc(100vw/7.5),52px)]",
            calendarClassName,
          )}
          startMonth={subMonths(festivalStartDate, 1)}
          endMonth={addMonths(festivalEndDate, 1)}
          disabled={[{ before: festivalStartDate }, { after: festivalEndDate }]}
          required
        />
      </DrawerContent>
    </Drawer>
  );
}
