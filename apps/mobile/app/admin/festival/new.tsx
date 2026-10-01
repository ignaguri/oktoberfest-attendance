import { zodResolver } from "@hookform/resolvers/zod";
import { formatDateForDatabase } from "@prostcounter/shared";
import { useCreateAdminFestival } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  AdminFestivalStatusSchema,
  type CreateAdminFestivalInput,
  CreateAdminFestivalSchema,
  FestivalTypeSchema,
} from "@prostcounter/shared/schemas";
import { cn } from "@prostcounter/ui";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { CalendarDays } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Platform } from "react-native";

import { useAlertDialog } from "@/components/ui/alert-dialog";
import { ConfirmAlertDialog } from "@/components/ui/alert-dialog/confirm";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";

const TEXT_FIELDS = [
  {
    name: "name",
    label: "admin.festivals.form.name",
    placeholder: "admin.festivals.form.namePlaceholder",
  },
  {
    name: "short_name",
    label: "admin.festivals.form.shortName",
    placeholder: "admin.festivals.form.shortNamePlaceholder",
  },
  {
    name: "location",
    label: "admin.festivals.form.location",
    placeholder: "admin.festivals.form.locationPlaceholder",
  },
] as const;

/** A calendar date picked on the device, at midday so no timezone shifts its day. */
function toPickerDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export default function AdminNewFestivalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { dialog, showDialog, closeDialog } = useAlertDialog();
  const createFestival = useCreateAdminFestival();

  const today = formatDateForDatabase(new Date());
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateAdminFestivalInput>({
    resolver: zodResolver(CreateAdminFestivalSchema),
    values: {
      name: "",
      short_name: "",
      location: "",
      festival_type: "oktoberfest",
      status: "upcoming",
      start_date: today,
      end_date: today,
    },
  });

  const onSubmit = useCallback(
    async (data: CreateAdminFestivalInput) => {
      try {
        const { festival } = await createFestival.mutate({
          ...data,
          name: data.name.trim(),
          short_name: data.short_name.trim(),
          location: data.location.trim(),
        });
        // Created inactive; the detail screen is where it gets activated and tents added
        router.replace(`/admin/festival/${festival.id}`);
      } catch (err) {
        // A 409 carries the server's reason (e.g. a taken short name)
        const message =
          err instanceof Error && err.message
            ? err.message
            : t("admin.mobile.festivals.createError");
        showDialog(t("common.status.error"), message);
      }
    },
    [createFestival, router, showDialog, t],
  );

  return (
    <>
      <ScrollView
        className="flex-1 bg-background-50"
        contentContainerClassName="p-4"
        keyboardShouldPersistTaps="handled"
      >
        <VStack space="md">
          <Card size="md" variant="elevated">
            <VStack space="md">
              {TEXT_FIELDS.map((field) => (
                <VStack key={field.name} space="sm">
                  <Text className="text-sm font-medium text-typography-700">{t(field.label)}</Text>
                  <Controller
                    control={control}
                    name={field.name}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input isInvalid={!!errors[field.name]}>
                        <InputField
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          placeholder={t(field.placeholder)}
                          autoCapitalize={field.name === "short_name" ? "none" : "words"}
                          accessibilityLabel={t(field.label)}
                        />
                      </Input>
                    )}
                  />
                  {errors[field.name] && (
                    <Text className="text-sm text-error-600">{t("validation.required")}</Text>
                  )}
                </VStack>
              ))}
            </VStack>
          </Card>

          <Card size="md" variant="elevated">
            <VStack space="md">
              <Controller
                control={control}
                name="start_date"
                render={({ field: { onChange, value } }) => (
                  <DateField
                    label={t("admin.festivals.form.startDate")}
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
              <Controller
                control={control}
                name="end_date"
                render={({ field: { onChange, value } }) => (
                  <DateField
                    label={t("admin.festivals.form.endDate")}
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
              {errors.end_date && (
                <Text className="text-sm text-error-600">
                  {t("admin.mobile.festivals.endBeforeStart")}
                </Text>
              )}
            </VStack>
          </Card>

          <Card size="md" variant="elevated">
            <VStack space="md">
              <Controller
                control={control}
                name="festival_type"
                render={({ field: { onChange, value } }) => (
                  <ChoiceRow
                    label={t("admin.festivals.form.type")}
                    options={FestivalTypeSchema.options.map((type) => ({
                      value: type,
                      label: t(`admin.festivals.types.${type}`),
                    }))}
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
              <Controller
                control={control}
                name="status"
                render={({ field: { onChange, value } }) => (
                  <ChoiceRow
                    label={t("admin.festivals.form.status")}
                    options={AdminFestivalStatusSchema.options.map((status) => ({
                      value: status,
                      label: t(`admin.mobile.festivals.status.${status}`),
                    }))}
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
            </VStack>
          </Card>

          <Button
            isDisabled={createFestival.loading}
            onPress={handleSubmit(onSubmit)}
            accessibilityLabel={t("admin.festivals.buttons.createFestival")}
          >
            {createFestival.loading && <ButtonSpinner />}
            <ButtonText>{t("admin.festivals.buttons.createFestival")}</ButtonText>
          </Button>

          <View className="h-4" />
        </VStack>
      </ScrollView>

      <ConfirmAlertDialog dialog={dialog} onClose={closeDialog} />
    </>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);

  const handleValueChange = useCallback(
    (_event: unknown, picked: Date) => {
      if (Platform.OS === "android") {
        setShowPicker(false);
      }
      onChange(formatDateForDatabase(picked));
    },
    [onChange],
  );

  return (
    <VStack space="sm">
      <Text className="text-sm font-medium text-typography-700">{label}</Text>
      <Pressable
        onPress={() => setShowPicker((open) => !open)}
        className="w-full rounded-lg border border-background-300 bg-background-0 px-4 py-3"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value }}
      >
        <HStack space="sm" className="items-center">
          <CalendarDays size={18} color={IconColors.muted} />
          <Text className="text-base text-typography-900">{value}</Text>
        </HStack>
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={toPickerDate(value)}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onValueChange={handleValueChange}
          onDismiss={() => setShowPicker(false)}
          accentColor={Colors.primary[500]}
        />
      )}

      {showPicker && Platform.OS === "ios" && (
        <Pressable
          onPress={() => setShowPicker(false)}
          className="items-center rounded-lg bg-primary-500 py-2"
          accessibilityRole="button"
          accessibilityLabel={t("common.buttons.done")}
        >
          <Text className="font-medium text-white">{t("common.buttons.done")}</Text>
        </Pressable>
      )}
    </VStack>
  );
}

function ChoiceRow<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
}) {
  return (
    <VStack space="sm">
      <Text className="text-sm font-medium text-typography-700">{label}</Text>
      <HStack space="sm" className="flex-wrap">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              className={cn(
                "mb-2 rounded-md border px-3 py-2",
                selected ? "border-primary-500 bg-primary-50" : "border-outline-200",
              )}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
            >
              <Text
                className={cn("text-sm", selected ? "text-primary-700" : "text-typography-600")}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </HStack>
    </VStack>
  );
}
