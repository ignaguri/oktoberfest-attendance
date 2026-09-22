"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n/client";
import { publicPathname } from "@/lib/utils/marketingUrl";

/**
 * Offers the live festival when the one restored on launch is not live, so a
 * pick made for an earlier festival does not silently stick.
 */
export function FestivalSwitchPrompt() {
  const { t } = useTranslation();
  const { currentFestival, switchSuggestion, setCurrentFestival, dismissSwitchSuggestion } =
    useFestival();
  const pathname = publicPathname(usePathname());

  // A group page picks its own festival once the group loads, so the prompt
  // must not flash over it while that request is still in flight
  const isGroupPage = pathname?.startsWith("/groups/");

  if (!currentFestival || !switchSuggestion || isGroupPage) {
    return null;
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          dismissSwitchSuggestion();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("festival.switchPrompt.title", { festival: switchSuggestion.name })}
          </DialogTitle>
          <DialogDescription>
            {t("festival.switchPrompt.description", {
              current: currentFestival.name,
              festival: switchSuggestion.name,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={dismissSwitchSuggestion}>
            {t("festival.switchPrompt.stay", { current: currentFestival.name })}
          </Button>
          <Button variant="yellow" onClick={() => setCurrentFestival(switchSuggestion)}>
            {t("festival.switchPrompt.switch", { festival: switchSuggestion.name })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
