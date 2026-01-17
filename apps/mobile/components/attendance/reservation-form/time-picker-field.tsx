import { useTranslation } from "@prostcounter/shared/i18n";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, setHours, setMinutes } from "date-fns";
import { Clock } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";

interface TimePickerFieldProps {
  /** The selected date (date portion) */
  selectedDate: Date;
  /** Current time value */
  value: Date;
  /** Called when time changes */
  onChange: (date: Date) => void;
  /** Optional label */
  label?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Error message */
  error?: string;
}

/**
 * Time picker field for selecting reservation time
 *
 * Uses native datetime picker on both iOS and Android.
 * On iOS, the picker is shown inline (spinner style).
 * On Android, the picker is shown as a modal.
 */
export function TimePickerField({
  selectedDate,
  value,
  onChange,
  label,
  disabled = false,
  error,
}: TimePickerFieldProps) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);

  // Format time for display
  const formattedTime = format(value, "HH:mm");

  // Handle time change from picker
  const handleChange = useCallback(
    (_event: unknown, date?: Date) => {
      // On Android, the picker closes automatically
      if (Platform.OS === "android") {
        setShowPicker(false);
      }

      if (date) {
        // Combine selected date with chosen time
        const newDateTime = setMinutes(
          setHours(selectedDate, date.getHours()),
          date.getMinutes(),
        );
        onChange(newDateTime);
      }
    },
    [selectedDate, onChange],
  );

  // Toggle picker visibility
  const handlePress = useCallback(() => {
    if (!disabled) {
      setShowPicker((prev) => !prev);
    }
  }, [disabled]);

  return (
    <VStack space="sm">
      {label && (
        <Text className="text-typography-700 text-sm font-medium">{label}</Text>
      )}

      <Pressable
        onPress={handlePress}
        disabled={disabled}
        className={`border-background-300 bg-background-0 w-full rounded-lg border px-4 py-3 ${
          disabled ? "opacity-50" : ""
        } ${error ? "border-error-500" : ""}`}
        accessibilityLabel={t("reservation.form.selectTime", {
          defaultValue: "Select time",
        })}
        accessibilityRole="button"
      >
        <HStack space="sm" className="items-center">
          <Clock size={18} color={IconColors.muted} />
          <Text
            className={`text-base ${
              value ? "text-typography-900" : "text-typography-400"
            }`}
          >
            {formattedTime}
          </Text>
        </HStack>
      </Pressable>

      {/* Error message */}
      {error && <Text className="text-error-600 text-sm">{error}</Text>}

      {/* Native Time Picker */}
      {showPicker && (
        <DateTimePicker
          value={value}
          mode="time"
          is24Hour={true}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleChange}
          accentColor={Colors.primary[500]}
        />
      )}

      {/* Done button for iOS (picker stays open) */}
      {showPicker && Platform.OS === "ios" && (
        <Pressable
          onPress={() => setShowPicker(false)}
          className="bg-primary-500 mt-2 items-center rounded-lg py-2"
        >
          <Text className="font-medium text-white">
            {t("common.buttons.done", { defaultValue: "Done" })}
          </Text>
        </Pressable>
      )}
    </VStack>
  );
}

TimePickerField.displayName = "TimePickerField";
