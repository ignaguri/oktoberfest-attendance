"use client";

import { useTents } from "@prostcounter/shared/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, apiClient } from "@/lib/api-client";
import { translateError, useTranslation } from "@/lib/i18n/client";

interface LogAnotherVisitProps {
  festivalId: string;
  disabled?: boolean;
  /**
   * Refresh the caller's view of the day, so its tent set includes the new visit.
   *
   * Awaited, and typed as returning a promise so it cannot be forgotten: while
   * the refresh is in flight the caller still holds the pre-visit tent set, and
   * submitting that set reconciles the day to it - deleting the visit just
   * logged. Takes no tent id; the caller re-reads the day from the server rather
   * than patching its own state.
   */
  onLogged: () => Promise<void>;
}

/**
 * Log one more visit to a tent, today.
 *
 * The form's tent field is a set, so it cannot say "this tent again, later":
 * saving the same set twice is a no-op. This appends a visit stamped with the
 * current time, which is what makes A, then B, then back to A expressible.
 *
 * Picking a tent logs it immediately - there is no separate confirm - because
 * the timestamp is the point and it is only accurate now.
 */
export function LogAnotherVisit({ festivalId, disabled = false, onLogged }: LogAnotherVisitProps) {
  const { t } = useTranslation();
  const { tents, isLoading, error } = useTents(festivalId);
  const [isLogging, setIsLogging] = useState(false);

  const handleSelect = async (tentId: string) => {
    setIsLogging(true);
    try {
      await apiClient.attendance.logTentVisit({
        festivalId,
        tentId,
        visitedAt: new Date().toISOString(),
      });
      // Awaited inside the try so the control stays disabled until the caller has
      // caught up, and so a failed refresh is not reported as a logged visit.
      await onLogged();
    } catch (logError) {
      // TENT_ALREADY_CURRENT_VISIT is the guard against logging the tent you are
      // already in, and it needs its own message: "something went wrong" would
      // read as a failure rather than as "go somewhere else first".
      if (logError instanceof ApiError) {
        toast.error(translateError(t, logError.code));
        return;
      }
      toast.error(t("notifications.error.attendanceUpdateFailed"));
    } finally {
      setIsLogging(false);
    }
  };

  if (isLoading) {
    return null;
  }

  // Say so rather than vanishing. Returning null on a failed tent fetch left no
  // trace of the control, so a user who knew it should be there had nothing to
  // act on and no reason given.
  if (error) {
    return (
      <p className="text-muted-foreground text-center text-sm">
        {t("attendance.form.logAnotherVisitUnavailable")}
      </p>
    );
  }

  if (tents.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Label htmlFor="log-another-visit">{t("attendance.form.logAnotherVisit")}</Label>
      <Select value="" disabled={disabled || isLogging} onValueChange={handleSelect}>
        {/*
          aria-describedby goes on the trigger, not on Select: Select is Radix's
          Root, which spreads its props onto a context provider and never renders
          a DOM node, so the attribute was silently dropped and the hint below was
          never announced. TypeScript does not catch it because hyphenated JSX
          attribute names are not checked.
        */}
        <SelectTrigger
          id="log-another-visit"
          className="w-4/5"
          aria-describedby="log-another-visit-hint"
        >
          <SelectValue placeholder={t("attendance.form.tentPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {tents.map((group) => (
            <SelectGroup key={group.category}>
              <SelectLabel>{group.category}</SelectLabel>
              {group.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <p id="log-another-visit-hint" className="text-muted-foreground text-sm">
        {t("attendance.form.logAnotherVisitHint")}
      </p>
    </div>
  );
}
