import { useTranslation } from "@prostcounter/shared/i18n";
import { Bell, ChevronDown } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

interface ReminderOption {
  value: number;
  label: string;
}

interface ReminderOffsetSelectProps {
  /** Current reminder offset in minutes */
  value: number;
  /** Called when selection changes */
  onChange: (minutes: number) => void;
  /** Optional label */
  label?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Reminder offset selector for reservations
 *
 * Provides a dropdown selection of common reminder timings:
 * - No reminder (0)
 * - 30 minutes before
 * - 1 hour before
 * - 2 hours before
 * - 1 day before (1440 minutes)
 */
export function ReminderOffsetSelect({
  value,
  onChange,
  label,
  disabled = false,
}: ReminderOffsetSelectProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Reminder options with translations
  const options = useMemo((): ReminderOption[] => {
    return [
      {
        value: 0,
        label: t("reservation.form.reminderOptions.none", {
          defaultValue: "No reminder",
        }),
      },
      {
        value: 30,
        label: t("reservation.form.reminderOptions.30min", {
          defaultValue: "30 minutes before",
        }),
      },
      {
        value: 60,
        label: t("reservation.form.reminderOptions.1hour", {
          defaultValue: "1 hour before",
        }),
      },
      {
        value: 120,
        label: t("reservation.form.reminderOptions.2hours", {
          defaultValue: "2 hours before",
        }),
      },
      {
        value: 1440,
        label: t("reservation.form.reminderOptions.1day", {
          defaultValue: "1 day before",
        }),
      },
    ];
  }, [t]);

  // Find current selection label
  const selectedLabel = useMemo(() => {
    const option = options.find((opt) => opt.value === value);
    return option?.label || options[0].label;
  }, [options, value]);

  // Handle option selection
  const handleSelect = useCallback(
    (optionValue: number) => {
      onChange(optionValue);
      setIsOpen(false);
    },
    [onChange],
  );

  return (
    <VStack space="sm">
      {label && (
        <Text className="text-typography-700 text-sm font-medium">{label}</Text>
      )}

      <Pressable
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={`border-background-300 bg-background-0 w-full rounded-lg border px-4 py-3 ${
          disabled ? "opacity-50" : ""
        }`}
        accessibilityRole="button"
        accessibilityLabel={t("reservation.form.reminder", {
          defaultValue: "Reminder",
        })}
        accessibilityValue={{ text: selectedLabel }}
      >
        <HStack className="items-center justify-between">
          <HStack space="sm" className="items-center">
            <Bell size={18} color={IconColors.muted} />
            <Text className="text-typography-900 text-base">
              {selectedLabel}
            </Text>
          </HStack>
          <ChevronDown size={18} color={IconColors.muted} />
        </HStack>
      </Pressable>

      {/* Selection Actionsheet */}
      <Actionsheet isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <Text className="text-typography-900 mb-4 text-center text-lg font-semibold">
            {t("reservation.form.reminder", { defaultValue: "Reminder" })}
          </Text>

          <ActionsheetScrollView className="max-h-64">
            {options.map((option) => (
              <ActionsheetItem
                key={option.value}
                onPress={() => handleSelect(option.value)}
                className={option.value === value ? "bg-primary-50" : ""}
              >
                <ActionsheetItemText
                  className={
                    option.value === value ? "text-primary-600 font-medium" : ""
                  }
                >
                  {option.label}
                </ActionsheetItemText>
              </ActionsheetItem>
            ))}
          </ActionsheetScrollView>
        </ActionsheetContent>
      </Actionsheet>
    </VStack>
  );
}

ReminderOffsetSelect.displayName = "ReminderOffsetSelect";
