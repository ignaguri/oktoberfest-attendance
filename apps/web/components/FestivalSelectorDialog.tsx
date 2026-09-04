"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import type { Festival } from "@prostcounter/shared/schemas";
import { formatLocalized, groupFestivalsByStatus } from "@prostcounter/shared/utils";
import { parseISO } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getFestivalDisplayInfo, getFestivalStatusBadgeProps } from "@/lib/festivalConstants";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface FestivalSelectorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FestivalSelectorDialog({ isOpen, onOpenChange }: FestivalSelectorDialogProps) {
  const { t } = useTranslation();
  const { currentFestival, festivals, setCurrentFestival } = useFestival();
  const [showPast, setShowPast] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  const { active, upcoming, past } = useMemo(
    () => groupFestivalsByStatus(festivals),
    [festivals],
  );

  const currentGroup = useMemo(() => [...active, ...upcoming], [active, upcoming]);

  // Expand the past section when collapsing it would hide the current
  // selection, or when there is nothing else to show.
  const shouldAutoExpand = useMemo(
    () => past.some((festival) => festival.id === currentFestival?.id) || currentGroup.length === 0,
    [past, currentFestival, currentGroup],
  );

  // Apply the auto-expand only on the closed -> open transition, so it never
  // overwrites a manual toggle while the dialog stays open.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setShowPast(shouldAutoExpand);
    }
  }

  const handleFestivalSelect = useCallback(
    (festival: Festival) => {
      setCurrentFestival(festival);
      onOpenChange(false);
    },
    [setCurrentFestival, onOpenChange],
  );

  const renderFestival = useCallback(
    (festival: Festival) => {
      const { firstLetter, lastTwoDigits } = getFestivalDisplayInfo(festival);
      const { status, variant } = getFestivalStatusBadgeProps(festival);
      const isSelected = festival.id === currentFestival?.id;

      return (
        <Button
          key={festival.id}
          variant={isSelected ? "default" : "outline"}
          className={cn(
            "h-auto w-full justify-start p-4",
            isSelected && "border-yellow-500 bg-yellow-500 hover:bg-yellow-600",
          )}
          onClick={() => handleFestivalSelect(festival)}
        >
          <div className="flex w-full items-center gap-3">
            <div
              className={cn(
                "flex size-10 flex-shrink-0 items-center justify-center rounded-md font-semibold",
                isSelected ? "bg-white text-yellow-500" : "bg-yellow-500 text-white",
              )}
            >
              <span className="text-base">
                {firstLetter}
                <sub className="text-sm">{lastTwoDigits}</sub>
              </span>
            </div>
            <div className="flex flex-col items-start text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium">{festival.name}</span>
                <Badge className="capitalize" variant={variant}>
                  {t(`festival.status.${status}`)}
                </Badge>
              </div>
              <div className="text-sm text-gray-600">
                {formatLocalized(parseISO(festival.startDate), "MMM d")} -{" "}
                {formatLocalized(parseISO(festival.endDate), "MMM d, yyyy")}
              </div>
              <span className="text-muted-foreground text-xs">{festival.location}</span>
            </div>
          </div>
        </Button>
      );
    },
    [currentFestival, handleFestivalSelect, t],
  );

  const pastLabel = t("festival.selector.pastFestivals", { count: past.length });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("festival.selector.title")}</DialogTitle>
          <DialogDescription>{t("festival.selector.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-96 gap-3 overflow-y-auto">
          {currentGroup.map(renderFestival)}
          {past.length > 0 && (
            <>
              <Button
                variant="ghost"
                className="h-auto w-full justify-between px-2 py-2 text-sm font-medium text-gray-600"
                onClick={() => setShowPast((previous) => !previous)}
                aria-expanded={showPast}
                title={t("festival.selector.pastFestivalsHint")}
              >
                {pastLabel}
                {showPast ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </Button>
              {showPast && past.map(renderFestival)}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
