import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateGroup } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { X } from "lucide-react-native";
import { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { logger } from "@/lib/logger";

// Form validation schema
const CreateGroupFormSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(100, "Group name must be 100 characters or less"),
  winningCriteria: z.enum(["days_attended", "total_beers", "avg_beers"]),
});

type CreateGroupFormData = z.infer<typeof CreateGroupFormSchema>;

interface CreateGroupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  festivalId: string;
  onSuccess: (groupId: string) => void;
}

const WINNING_CRITERIA_OPTIONS = [
  {
    value: "total_beers",
    label: "groups.criteria.totalBeers",
    defaultLabel: "Total Beers",
  },
  {
    value: "days_attended",
    label: "groups.criteria.daysAttended",
    defaultLabel: "Days Attended",
  },
  {
    value: "avg_beers",
    label: "groups.criteria.avgBeers",
    defaultLabel: "Avg Beers per Day",
  },
] as const;

export function CreateGroupSheet({
  isOpen,
  onClose,
  festivalId,
  onSuccess,
}: CreateGroupSheetProps) {
  const { t } = useTranslation();
  const createGroup = useCreateGroup();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateGroupFormData>({
    resolver: zodResolver(CreateGroupFormSchema),
    defaultValues: {
      name: "",
      winningCriteria: "total_beers",
    },
  });

  const onSubmit = useCallback(
    async (data: CreateGroupFormData) => {
      try {
        const groupId = await createGroup.mutateAsync({
          groupName: data.name,
          password: "", // Not used by API, but required by current hook signature
          festivalId,
          winningCriteria: data.winningCriteria,
        });

        reset();
        onSuccess(groupId);
      } catch (error) {
        logger.error("Failed to create group:", error);
        // Error handling is done via the hook's error state
      }
    },
    [createGroup, festivalId, reset, onSuccess],
  );

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const isSubmitting = createGroup.loading;

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85%]">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {/* Header */}
        <HStack className="mb-4 w-full items-center justify-between px-2">
          <Text className="text-lg font-semibold text-typography-900">
            {t("groups.create.title")}
          </Text>
          <Pressable onPress={handleClose} hitSlop={8}>
            <X size={24} color={IconColors.default} />
          </Pressable>
        </HStack>

        <ActionsheetScrollView className="w-full">
          <VStack space="xl" className="px-2 pb-4">
            {/* Group Name Input */}
            <VStack space="sm">
              <Text className="text-sm font-medium text-typography-700">
                {t("groups.create.nameLabel")}
              </Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input size="md">
                    <InputField
                      placeholder={t("groups.create.namePlaceholder")}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoCapitalize="words"
                    />
                  </Input>
                )}
              />
              {errors.name && (
                <Text className="text-sm text-error-600">
                  {t(errors.name.message || "validation.required")}
                </Text>
              )}
            </VStack>

            {/* Winning Criteria Select */}
            <VStack space="sm">
              <Text className="text-sm font-medium text-typography-700">
                {t("groups.create.criteriaLabel")}
              </Text>
              <Controller
                control={control}
                name="winningCriteria"
                render={({ field: { onChange, value } }) => (
                  <Select selectedValue={value} onValueChange={onChange}>
                    <SelectTrigger variant="outline" size="md">
                      <SelectInput
                        placeholder={t("groups.create.criteriaPlaceholder")}
                        value={
                          WINNING_CRITERIA_OPTIONS.find(
                            (opt) => opt.value === value,
                          )
                            ? t(
                                WINNING_CRITERIA_OPTIONS.find(
                                  (opt) => opt.value === value,
                                )!.label,
                              )
                            : ""
                        }
                      />
                      <SelectIcon className="mr-3" />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent>
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        {WINNING_CRITERIA_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            label={t(option.label)}
                            value={option.value}
                          />
                        ))}
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                )}
              />
              {errors.winningCriteria && (
                <Text className="text-sm text-error-600">
                  {t(errors.winningCriteria.message || "validation.required")}
                </Text>
              )}
            </VStack>

            {/* Helper text */}
            <Text className="text-sm text-typography-500">
              {t("groups.create.criteriaHelp")}
            </Text>
          </VStack>
        </ActionsheetScrollView>

        {/* Footer Buttons */}
        <HStack className="w-full gap-3 px-2 pt-3">
          <Button
            variant="outline"
            action="secondary"
            className="flex-1"
            onPress={handleClose}
            isDisabled={isSubmitting}
          >
            <ButtonText>{t("common.buttons.cancel")}</ButtonText>
          </Button>
          <Button
            variant="solid"
            action="primary"
            className="flex-1"
            onPress={handleSubmit(onSubmit)}
            isDisabled={isSubmitting}
          >
            {isSubmitting && <ButtonSpinner color={Colors.white} />}
            <ButtonText>
              {isSubmitting
                ? t("common.status.creating")
                : t("groups.actions.create")}
            </ButtonText>
          </Button>
        </HStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}

CreateGroupSheet.displayName = "CreateGroupSheet";
