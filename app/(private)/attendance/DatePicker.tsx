"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { TIMEZONE } from "@/lib/constants";
import { TZDate } from "@date-fns/tz";
import { format as formatDateFns } from "date-fns";
import { isAfter, isBefore } from "date-fns";
import { useMemo, useState } from "react";

interface MyDatePickerProps {
  disabled?: boolean;
  name?: string;
  onDateChange: (date: Date | null) => void;
  value?: Date;
  festivalStartDate: Date;
  festivalEndDate: Date;
}

export function MyDatePicker({
  disabled = false,
  name = "date",
  onDateChange,
  value = new Date(),
  festivalStartDate,
  festivalEndDate,
}: MyDatePickerProps) {
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
            className="w-fit"
            disabled={disabled}
            type="button"
          >
            {selectedLabel}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="w-auto overflow-hidden p-0">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Select date</DrawerTitle>
          </DrawerHeader>
          <div className="mx-auto py-2">
            <Calendar
              mode="single"
              selected={clampedValue}
              defaultMonth={clampedValue}
              onSelect={(date) => {
                if (date) {
                  onDateChange(date);
                }
                setOpen(false);
              }}
              className="mx-auto [--cell-size:clamp(0px,calc(100vw/7.5),52px)]"
              startMonth={festivalStartDate}
              endMonth={festivalEndDate}
              disabled={[
                { before: festivalStartDate },
                { after: festivalEndDate },
              ]}
              required
            />
          </div>
        </DrawerContent>
      </Drawer>
      <input type="hidden" name={name} value={clampedValue.toISOString()} />
    </div>
  );
}
