"use client";

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
import { TIMEZONE } from "@/lib/constants";
import { TZDate } from "@date-fns/tz";
import { format as formatDateFns, addMonths, subMonths } from "date-fns";
import { isAfter, isBefore } from "date-fns";
import { CalendarPlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

interface AttendanceDatePickerProps {
  disabled?: boolean;
  name?: string;
  onDateChange: (date: Date | null) => void;
  value?: Date;
  festivalStartDate: Date;
  festivalEndDate: Date;
}

export function AttendanceDatePicker({
  disabled = false,
  name = "date",
  onDateChange,
  value = new Date(),
  festivalStartDate,
  festivalEndDate,
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
    <div className="w-full">
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            className="w-fit justify-between gap-2"
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
            <DrawerDescription>
              Set the date of your attendance
            </DrawerDescription>
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
            className="mx-auto [--cell-size:clamp(0px,calc(100vw/7.5),52px)]"
            startMonth={subMonths(festivalStartDate, 1)}
            endMonth={addMonths(festivalEndDate, 1)}
            disabled={[
              { before: festivalStartDate },
              { after: festivalEndDate },
            ]}
            required
          />
        </DrawerContent>
      </Drawer>
    </div>
  );
}
