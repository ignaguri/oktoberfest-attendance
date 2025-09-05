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

function generateTimePresets(
  startHour: number,
  endHour: number,
  intervalMinutes: number,
) {
  const presets = [];
  for (
    let minutes = startHour * 60;
    minutes <= endHour * 60;
    minutes += intervalMinutes
  ) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const label = `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
    presets.push({ label, hours, minutes: mins });
  }
  return presets;
}

const timePresets = generateTimePresets(9, 18, 15);
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
