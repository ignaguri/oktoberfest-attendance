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
  /** Called with the logged tent so the caller can refresh and keep its set in step. */
  onLogged: (tentId: string) => void;
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
  const { tents, isLoading } = useTents(festivalId);
  const [isLogging, setIsLogging] = useState(false);

  const handleSelect = async (tentId: string) => {
    setIsLogging(true);
    try {
      await apiClient.attendance.logTentVisit({
        festivalId,
        tentId,
        visitedAt: new Date().toISOString(),
      });
      onLogged(tentId);
    } catch (error) {
      // TENT_ALREADY_CURRENT_VISIT is the guard against logging the tent you are
      // already in, and it needs its own message: "something went wrong" would
      // read as a failure rather than as "go somewhere else first".
      if (error instanceof ApiError) {
        toast.error(translateError(t, error.code));
        return;
      }
      toast.error(t("notifications.error.attendanceUpdateFailed"));
    } finally {
      setIsLogging(false);
    }
  };

  if (isLoading || tents.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Label htmlFor="log-another-visit">{t("attendance.form.logAnotherVisit")}</Label>
      <Select
        value=""
        disabled={disabled || isLogging}
        onValueChange={handleSelect}
        aria-describedby="log-another-visit-hint"
      >
        <SelectTrigger id="log-another-visit" className="w-4/5">
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
