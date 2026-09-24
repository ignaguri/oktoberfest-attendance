import { zodResolver } from "@hookform/resolvers/zod";
import { useSubmitFeedback } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  createFeedbackFormSchema,
  FEEDBACK_FACES,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  type FeedbackFormValues,
} from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { Check, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, type Resolver, useForm } from "react-hook-form";

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
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { logger } from "@/lib/logger";

export type FeedbackSheetMode =
  | { kind: "day"; festivalId: string; festivalName: string; day: string }
  | { kind: "bug" }
  | { kind: "idea" };

export type FeedbackSheetCloseReason = "sent" | "dismissed";

interface FeedbackSheetProps {
  isOpen: boolean;
  mode: FeedbackSheetMode;
  onClose: (reason: FeedbackSheetCloseReason) => void;
}

const EMPTY_FORM: FeedbackFormValues = { rating: undefined, message: "" };

export function FeedbackSheet({ isOpen, mode, onClose }: FeedbackSheetProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const submitFeedback = useSubmitFeedback();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const schema = useMemo(() => createFeedbackFormSchema(mode.kind), [mode.kind]);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeedbackFormValues>({
    resolver: zodResolver(schema) as Resolver<FeedbackFormValues>,
    defaultValues: EMPTY_FORM,
  });

  // Every opening starts from an empty form
  useEffect(() => {
    if (isOpen) {
      reset(EMPTY_FORM);
      setSubmitError(null);
    }
  }, [isOpen, reset]);

  const handleDismiss = useCallback(() => {
    if (submitFeedback.loading) {
      return;
    }
    onClose("dismissed");
  }, [onClose, submitFeedback.loading]);

  const onSubmit = useCallback(
    async (values: FeedbackFormValues) => {
      setSubmitError(null);
      try {
        if (mode.kind === "day") {
          await submitFeedback.mutateAsync({
            kind: "day",
            rating: values.rating as number,
            message: values.message,
            festivalId: mode.festivalId,
            day: mode.day,
          });
        } else {
          await submitFeedback.mutateAsync({ kind: mode.kind, message: values.message });
        }
        toast.show({
          placement: "top",
          render: () => (
            <HStack className="items-center gap-2 rounded-lg bg-success-500 px-4 py-3">
              <Check size={18} color={Colors.white} />
              <Text className="font-medium text-white">{t("feedback.thanks")}</Text>
            </HStack>
          ),
        });
        onClose("sent");
      } catch (error: any) {
        logger.error("Failed to send feedback:", error);
        setSubmitError(
          error?.code === "FEEDBACK_RATE_LIMITED"
            ? t("apiErrors.FEEDBACK_RATE_LIMITED")
            : t("feedback.error"),
        );
      }
    },
    [mode, submitFeedback, toast, t, onClose],
  );

  const isSubmitting = submitFeedback.loading;
  const title =
    mode.kind === "day"
      ? t("feedback.day.title")
      : mode.kind === "bug"
        ? t("feedback.bug.title")
        : t("feedback.idea.title");

  return (
    <Actionsheet isOpen={isOpen} onClose={handleDismiss}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85%]">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <HStack className="mb-4 w-full items-start justify-between px-2">
          <VStack space="xs" className="flex-1">
            <Text className="text-lg font-semibold text-typography-900">{title}</Text>
            {mode.kind === "day" && (
              <Text className="text-sm text-typography-500">
                {t("feedback.day.subtitle", {
                  festival: mode.festivalName,
                  date: formatLocalized(new Date(`${mode.day}T12:00:00`), "EEEE, d MMMM"),
                })}
              </Text>
            )}
          </VStack>
          <Pressable
            onPress={handleDismiss}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.buttons.close")}
            accessibilityHint={t("feedback.day.notNow")}
          >
            <X size={24} color={IconColors.default} />
          </Pressable>
        </HStack>

        <ActionsheetScrollView className="w-full">
          <VStack space="lg" className="px-2 pb-4">
            {mode.kind === "day" && (
              <Controller
                control={control}
                name="rating"
                render={({ field: { onChange, value } }) => (
                  <VStack space="sm">
                    <HStack
                      className="justify-between"
                      accessibilityRole="radiogroup"
                      accessibilityLabel={t("feedback.day.facesLabel")}
                    >
                      {FEEDBACK_FACES.map((face) => {
                        const isSelected = value === face.rating;
                        return (
                          <Pressable
                            key={face.rating}
                            onPress={() => onChange(face.rating)}
                            className={cn(
                              "items-center rounded-xl border-2 px-2 py-2",
                              isSelected
                                ? "border-primary-500 bg-primary-50"
                                : "border-transparent",
                            )}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={t(face.labelKey)}
                            accessibilityHint={t("feedback.day.facesLabel")}
                          >
                            <Text className="text-3xl">{face.emoji}</Text>
                            <Text className="text-xs text-typography-500">{t(face.labelKey)}</Text>
                          </Pressable>
                        );
                      })}
                    </HStack>
                    {errors.rating?.message && (
                      <Text className="text-sm text-error-600">{t(errors.rating.message)}</Text>
                    )}
                  </VStack>
                )}
              />
            )}

            <VStack space="sm">
              <Text className="text-sm font-medium text-typography-700">
                {mode.kind === "day"
                  ? t("feedback.day.textLabel")
                  : mode.kind === "bug"
                    ? t("feedback.bug.label")
                    : t("feedback.idea.label")}
              </Text>
              <Controller
                control={control}
                name="message"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Textarea size="md" isDisabled={isSubmitting}>
                    <TextareaInput
                      placeholder={
                        mode.kind === "day"
                          ? t("feedback.day.textPlaceholder")
                          : mode.kind === "bug"
                            ? t("feedback.bug.placeholder")
                            : t("feedback.idea.placeholder")
                      }
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
                      accessibilityLabel={
                        mode.kind === "day"
                          ? t("feedback.day.textLabel")
                          : mode.kind === "bug"
                            ? t("feedback.bug.label")
                            : t("feedback.idea.label")
                      }
                    />
                  </Textarea>
                )}
              />
              {errors.message?.message && (
                <Text className="text-sm text-error-600">{t(errors.message.message)}</Text>
              )}
              {mode.kind === "bug" && (
                <Text className="text-xs text-typography-500">{t("feedback.bug.contextNote")}</Text>
              )}
            </VStack>

            {submitError && <Text className="text-sm text-error-600">{submitError}</Text>}

            {/* Inside the scroll view so the keyboard padding keeps the buttons reachable while typing */}
            <HStack className="w-full gap-3 pt-2">
              <Button
                variant="outline"
                action="secondary"
                className="flex-1"
                onPress={handleDismiss}
                isDisabled={isSubmitting}
                accessibilityLabel={
                  mode.kind === "day" ? t("feedback.day.notNow") : t("common.buttons.cancel")
                }
              >
                <ButtonText>
                  {mode.kind === "day" ? t("feedback.day.notNow") : t("common.buttons.cancel")}
                </ButtonText>
              </Button>
              <Button
                variant="solid"
                action="primary"
                className="flex-1"
                onPress={handleSubmit(onSubmit)}
                isDisabled={isSubmitting}
                accessibilityLabel={t("feedback.send")}
                accessibilityHint={t("feedback.sendHint")}
              >
                {isSubmitting && <ButtonSpinner color={Colors.white} />}
                <ButtonText>{isSubmitting ? t("feedback.sending") : t("feedback.send")}</ButtonText>
              </Button>
            </HStack>
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
