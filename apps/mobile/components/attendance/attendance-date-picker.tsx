import { useState, useCallback } from "react";
import { Platform } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { IconColors } from "@/lib/constants/colors";

interface AttendanceDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
}

/**
 * Date picker for attendance records
 *
 * Shows formatted date and opens native date picker on press.
 * Respects festival date constraints (minDate/maxDate).
 */
export function AttendanceDatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
}: AttendanceDatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Format date for display
  const formattedDate = value.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handlePress = useCallback(() => {
    if (!disabled) {
      setShowPicker(true);
    }
  }, [disabled]);

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      // On Android, the picker closes automatically
      if (Platform.OS === "android") {
        setShowPicker(false);
      }

      if (event.type === "set" && selectedDate) {
        onChange(selectedDate);
      }

      // On iOS, we need to explicitly close on dismiss
      if (event.type === "dismissed") {
        setShowPicker(false);
      }
    },
    [onChange]
  );

  const handleIOSConfirm = useCallback(() => {
    setShowPicker(false);
  }, []);

  return (
    <>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        className={`w-full rounded-lg border border-background-300 bg-background-0 px-4 py-3 ${
          disabled ? "opacity-50" : ""
        }`}
        accessibilityRole="button"
        accessibilityLabel={`Select date, currently ${formattedDate}`}
      >
        <HStack className="items-center justify-between">
          <Text className="text-base text-typography-900">{formattedDate}</Text>
          <Calendar size={20} color={IconColors.muted} />
        </HStack>
      </Pressable>

      {showPicker && (
        <>
          {Platform.OS === "ios" ? (
            // iOS: Show inline picker with confirm button
            <>
              <DateTimePicker
                value={value}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                minimumDate={minDate}
                maximumDate={maxDate}
              />
              <Pressable
                onPress={handleIOSConfirm}
                className="mt-2 self-end px-4 py-2"
              >
                <Text className="text-primary-500 font-semibold">Done</Text>
              </Pressable>
            </>
          ) : (
            // Android: Show modal picker
            <DateTimePicker
              value={value}
              mode="date"
              display="default"
              onChange={handleDateChange}
              minimumDate={minDate}
              maximumDate={maxDate}
            />
          )}
        </>
      )}
    </>
  );
}

AttendanceDatePicker.displayName = "AttendanceDatePicker";
