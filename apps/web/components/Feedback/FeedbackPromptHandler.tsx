"use client";

import { useCanShowLaunchPopups } from "@prostcounter/shared/contexts";
import { useDayFeedbackPrompt, useDismissDayFeedbackPrompt } from "@prostcounter/shared/hooks";
import { claimLaunchPopupSlot, releaseLaunchPopupSlot } from "@prostcounter/shared/utils";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  FeedbackDialog,
  type FeedbackDialogCloseReason,
  type FeedbackDialogMode,
} from "@/components/Feedback/FeedbackDialog";

const SLOT_OWNER = "day-feedback";
const PROMPT_DELAY_MS = 3000;

/**
 * The day prompt on web (checked once per page load, on Home), plus the
 * /home?feedback=bug|idea links that /r/bugs and /r/feedback point at.
 */
export default function FeedbackPromptHandler() {
  const canShowLaunchPopups = useCanShowLaunchPopups();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dialogMode, setDialogMode] = useState<FeedbackDialogMode | null>(null);
  const [isHandled, setIsHandled] = useState(false);

  const { prompt } = useDayFeedbackPrompt({ enabled: canShowLaunchPopups });
  const dismissPrompt = useDismissDayFeedbackPrompt();

  // A short link asked for the dialog: open it once and clean the URL
  const requestedKind = searchParams.get("feedback");
  useEffect(() => {
    if (requestedKind !== "bug" && requestedKind !== "idea") {
      return;
    }
    setDialogMode({ kind: requestedKind });
    setIsHandled(true);
    const params = new URLSearchParams(window.location.search);
    params.delete("feedback");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [requestedKind]);

  useEffect(() => {
    if (!prompt || dialogMode || isHandled || !pathname.endsWith("/home") || !canShowLaunchPopups) {
      return;
    }
    const timerId = setTimeout(() => {
      if (claimLaunchPopupSlot(SLOT_OWNER)) {
        setDialogMode({
          kind: "day",
          festivalId: prompt.festivalId,
          festivalName: prompt.festivalName,
          day: prompt.day,
        });
      }
    }, PROMPT_DELAY_MS);
    return () => {
      clearTimeout(timerId);
    };
  }, [prompt, dialogMode, isHandled, pathname, canShowLaunchPopups]);

  const handleClose = useCallback(
    (reason: FeedbackDialogCloseReason) => {
      const closedMode = dialogMode;
      setDialogMode(null);
      setIsHandled(true);
      if (closedMode?.kind === "day") {
        releaseLaunchPopupSlot(SLOT_OWNER);
        if (reason === "dismissed") {
          dismissPrompt
            .mutateAsync({ festivalId: closedMode.festivalId, day: closedMode.day })
            .catch(() => {
              // Not worth surfacing: at worst the prompt comes back once
            });
        }
      }
    },
    [dialogMode, dismissPrompt],
  );

  if (!dialogMode) {
    return null;
  }

  return <FeedbackDialog open mode={dialogMode} onClose={handleClose} />;
}
