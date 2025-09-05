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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useMediaQuery from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import * as React from "react";

interface DateTimePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  calendarClassName?: string;
}

const timePresets = [
  { label: "09:00", hours: 9, minutes: 0 },
  { label: "09:15", hours: 9, minutes: 15 },
  { label: "09:30", hours: 9, minutes: 30 },
  { label: "09:45", hours: 9, minutes: 45 },
  { label: "10:00", hours: 10, minutes: 0 },
  { label: "10:15", hours: 10, minutes: 15 },
  { label: "10:30", hours: 10, minutes: 30 },
  { label: "10:45", hours: 10, minutes: 45 },
  { label: "11:00", hours: 11, minutes: 0 },
  { label: "11:15", hours: 11, minutes: 15 },
  { label: "11:30", hours: 11, minutes: 30 },
  { label: "11:45", hours: 11, minutes: 45 },
  { label: "12:00", hours: 12, minutes: 0 },
  { label: "12:15", hours: 12, minutes: 15 },
  { label: "12:30", hours: 12, minutes: 30 },
  { label: "12:45", hours: 12, minutes: 45 },
  { label: "13:00", hours: 13, minutes: 0 },
  { label: "13:15", hours: 13, minutes: 15 },
  { label: "13:30", hours: 13, minutes: 30 },
  { label: "13:45", hours: 13, minutes: 45 },
  { label: "14:00", hours: 14, minutes: 0 },
  { label: "14:15", hours: 14, minutes: 15 },
  { label: "14:30", hours: 14, minutes: 30 },
  { label: "14:45", hours: 14, minutes: 45 },
  { label: "15:00", hours: 15, minutes: 0 },
  { label: "15:15", hours: 15, minutes: 15 },
  { label: "15:30", hours: 15, minutes: 30 },
  { label: "15:45", hours: 15, minutes: 45 },
  { label: "16:00", hours: 16, minutes: 0 },
  { label: "16:15", hours: 16, minutes: 15 },
  { label: "16:30", hours: 16, minutes: 30 },
  { label: "16:45", hours: 16, minutes: 45 },
  { label: "17:00", hours: 17, minutes: 0 },
  { label: "17:15", hours: 17, minutes: 15 },
  { label: "17:30", hours: 17, minutes: 30 },
  { label: "17:45", hours: 17, minutes: 45 },
  { label: "18:00", hours: 18, minutes: 0 },
];

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  disabled = false,
  className,
  calendarClassName,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    value,
  );
  const isDesktop = useMediaQuery("(min-width: 768px)");

  React.useEffect(() => {
    setSelectedDate(value);
  }, [value]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedDate(undefined);
      onChange?.(undefined);
      return;
    }

    const newDate = new Date(date);
    if (selectedDate) {
      newDate.setHours(selectedDate.getHours());
      newDate.setMinutes(selectedDate.getMinutes());
    } else {
      newDate.setHours(9); // Default to 9 AM
      newDate.setMinutes(0);
    }

    setSelectedDate(newDate);
    onChange?.(newDate);
  };

  const handleTimePresetSelect = (hours: number, minutes: number) => {
    if (!selectedDate) return;

    const newDate = new Date(selectedDate);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);

    setSelectedDate(newDate);
    onChange?.(newDate);
    setOpen(false);
  };

  const formatDateTime = (date: Date) => {
    return `${format(date, "PPP")} at ${format(date, "HH:mm")}`;
  };

  const DateTimeContent = () => (
    <div className="flex flex-col">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={handleDateSelect}
        autoFocus
        className={calendarClassName}
      />
      <div className="p-3 flex flex-col space-y-2 border-t">
        <div className="flex items-center space-x-2 mb-2">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">Time</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {timePresets.map((preset) => (
            <Button
              key={preset.label}
              variant={
                selectedDate?.getHours() === preset.hours &&
                selectedDate?.getMinutes() === preset.minutes
                  ? "default"
                  : "outline"
              }
              size="sm"
              className="text-xs h-8"
              onClick={() =>
                handleTimePresetSelect(preset.hours, preset.minutes)
              }
              disabled={!selectedDate}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  const TriggerButton = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
  >(({ onClick, ...props }, ref) => (
    <Button
      ref={ref}
      variant="outline"
      className={cn(
        "w-full justify-start text-left font-normal",
        !selectedDate && "text-muted-foreground",
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      <CalendarIcon className="mr-2 h-4 w-4" />
      {selectedDate ? formatDateTime(selectedDate) : placeholder}
    </Button>
  ));
  TriggerButton.displayName = "TriggerButton";

  if (!isDesktop) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <TriggerButton />
        </DrawerTrigger>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>Select Date & Time</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            <DateTimeContent />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TriggerButton />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            autoFocus
            className={calendarClassName}
          />
          <div className="p-3 flex flex-col space-y-2">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Time</span>
            </div>
            <div className="grid grid-cols-2 gap-1 max-w-xs">
              {timePresets.map((preset) => (
                <Button
                  key={preset.label}
                  variant={
                    selectedDate?.getHours() === preset.hours &&
                    selectedDate?.getMinutes() === preset.minutes
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  className="text-xs h-8"
                  onClick={() =>
                    handleTimePresetSelect(preset.hours, preset.minutes)
                  }
                  disabled={!selectedDate}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
