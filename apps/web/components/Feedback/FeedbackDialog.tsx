"use client";

// standardSchemaResolver, not zodResolver: see UploadAvatarForm.tsx for the Turbopack reason
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useSubmitFeedback } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  createFeedbackFormSchema,
  FEEDBACK_FACES,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  type FeedbackFormValues,
} from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type FeedbackDialogMode =
  | { kind: "day"; festivalId: string; festivalName: string; day: string }
  | { kind: "bug" }
  | { kind: "idea" };

export type FeedbackDialogCloseReason = "sent" | "dismissed";

interface FeedbackDialogProps {
  open: boolean;
  mode: FeedbackDialogMode;
  onClose: (reason: FeedbackDialogCloseReason) => void;
}

const EMPTY_FORM: FeedbackFormValues = { rating: undefined, message: "" };

export function FeedbackDialog({ open, mode, onClose }: FeedbackDialogProps) {
  const { t } = useTranslation();
  const submitFeedback = useSubmitFeedback();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const schema = useMemo(() => createFeedbackFormSchema(mode.kind), [mode.kind]);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeedbackFormValues>({
    resolver: standardSchemaResolver(schema) as Resolver<FeedbackFormValues>,
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (open) {
      reset(EMPTY_FORM);
      setSubmitError(null);
    }
  }, [open, reset]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !submitFeedback.loading) {
        onClose("dismissed");
      }
    },
    [onClose, submitFeedback.loading],
  );

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
        toast.success(t("feedback.thanks"));
        onClose("sent");
      } catch (error: any) {
        setSubmitError(
          error?.code === "FEEDBACK_RATE_LIMITED"
            ? t("apiErrors.FEEDBACK_RATE_LIMITED")
            : t("feedback.error"),
        );
      }
    },
    [mode, submitFeedback, t, onClose],
  );

  const isSubmitting = submitFeedback.loading;
  const title =
    mode.kind === "day"
      ? t("feedback.day.title")
      : mode.kind === "bug"
        ? t("feedback.bug.title")
        : t("feedback.idea.title");
  const description =
    mode.kind === "day"
      ? t("feedback.day.subtitle", {
          festival: mode.festivalName,
          date: formatLocalized(new Date(`${mode.day}T12:00:00`), "EEEE, d MMMM"),
        })
      : mode.kind === "bug"
        ? t("feedback.bug.description")
        : t("feedback.idea.description");
  const textLabel =
    mode.kind === "day"
      ? t("feedback.day.textLabel")
      : mode.kind === "bug"
        ? t("feedback.bug.label")
        : t("feedback.idea.label");
  const textPlaceholder =
    mode.kind === "day"
      ? t("feedback.day.textPlaceholder")
      : mode.kind === "bug"
        ? t("feedback.bug.placeholder")
        : t("feedback.idea.placeholder");

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4 px-4 pb-4 text-left sm:px-0 sm:pb-0"
      >
        {mode.kind === "day" && (
          <Controller
            control={control}
            name="rating"
            render={({ field: { onChange, value } }) => (
              <div className="flex flex-col gap-2">
                <div
                  role="radiogroup"
                  aria-label={t("feedback.day.facesLabel")}
                  className="flex justify-between gap-1"
                >
                  {FEEDBACK_FACES.map((face) => {
                    const isSelected = value === face.rating;
                    return (
                      <button
                        key={face.rating}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={t(face.labelKey)}
                        onClick={() => onChange(face.rating)}
                        className={cn(
                          "flex flex-1 flex-col items-center rounded-xl border-2 px-1 py-2",
                          isSelected ? "border-yellow-500 bg-yellow-50" : "border-transparent",
                        )}
                      >
                        <span className="text-3xl" aria-hidden>
                          {face.emoji}
                        </span>
                        <span className="text-xs text-gray-500">{t(face.labelKey)}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.rating?.message && (
                  <p className="text-sm text-red-600">{t(errors.rating.message)}</p>
                )}
              </div>
            )}
          />
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="feedback-message">{textLabel}</Label>
          <Controller
            control={control}
            name="message"
            render={({ field }) => (
              <Textarea
                id="feedback-message"
                placeholder={textPlaceholder}
                maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
                disabled={isSubmitting}
                rows={4}
                {...field}
              />
            )}
          />
          {errors.message?.message && (
            <p className="text-sm text-red-600">{t(errors.message.message)}</p>
          )}
          {mode.kind === "bug" && (
            <p className="text-xs text-gray-500">{t("feedback.bug.contextNote")}</p>
          )}
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={isSubmitting}
            onClick={() => onClose("dismissed")}
          >
            {mode.kind === "day" ? t("feedback.day.notNow") : t("common.buttons.cancel")}
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? t("feedback.sending") : t("feedback.send")}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
