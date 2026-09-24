import { useCanShowLaunchPopups } from "@prostcounter/shared/contexts";
import { useDayFeedbackPrompt, useDismissDayFeedbackPrompt } from "@prostcounter/shared/hooks";
import { claimLaunchPopupSlot, releaseLaunchPopupSlot } from "@prostcounter/shared/utils";
import { usePathname } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { FeedbackSheet, type FeedbackSheetCloseReason } from "@/components/feedback/feedback-sheet";
import { useAuth } from "@/lib/auth/AuthContext";
import { logger } from "@/lib/logger";

const SLOT_OWNER = "day-feedback";
const HOME_PATHNAME = "/home";
/** Lets Home settle before a sheet slides over it. */
const PROMPT_DELAY_MS = 3000;
/** A resume after this long counts as a new app open. */
const RECHECK_AFTER_MS = 6 * 60 * 60 * 1000;

/**
 * Asks how yesterday went, on the next app open after a day with drinks.
 *
 * The server decides whether a prompt is due; this only picks the moment:
 * after the festival-switch prompt has had its turn, on Home, and never on
 * top of another launch popup that holds the slot.
 */
export function FeedbackPromptHandler() {
  const { isAuthenticated } = useAuth();
  const canShowLaunchPopups = useCanShowLaunchPopups();
  const pathname = usePathname();
  const [isCheckEnabled, setIsCheckEnabled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isHandled, setIsHandled] = useState(false);
  const lastCheckedAtRef = useRef(0);

  const { prompt, refetch } = useDayFeedbackPrompt({ enabled: isAuthenticated && isCheckEnabled });
  const dismissPrompt = useDismissDayFeedbackPrompt();

  // First check of the session waits for the launch popups that go first
  useEffect(() => {
    if (isAuthenticated && canShowLaunchPopups && !isCheckEnabled) {
      lastCheckedAtRef.current = Date.now();
      setIsCheckEnabled(true);
    }
  }, [isAuthenticated, canShowLaunchPopups, isCheckEnabled]);

  // The app usually resumes rather than cold-starts the next morning
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (
        state === "active" &&
        isCheckEnabled &&
        Date.now() - lastCheckedAtRef.current > RECHECK_AFTER_MS
      ) {
        lastCheckedAtRef.current = Date.now();
        setIsHandled(false);
        void refetch();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [isCheckEnabled, refetch]);

  useEffect(() => {
    if (!prompt || isOpen || isHandled || pathname !== HOME_PATHNAME || !canShowLaunchPopups) {
      return;
    }
    const timerId = setTimeout(() => {
      if (claimLaunchPopupSlot(SLOT_OWNER)) {
        setIsOpen(true);
      }
    }, PROMPT_DELAY_MS);
    return () => {
      clearTimeout(timerId);
    };
  }, [prompt, isOpen, isHandled, pathname, canShowLaunchPopups]);

  const handleClose = useCallback(
    (reason: FeedbackSheetCloseReason) => {
      setIsOpen(false);
      setIsHandled(true);
      releaseLaunchPopupSlot(SLOT_OWNER);
      if (reason === "dismissed" && prompt) {
        dismissPrompt
          .mutateAsync({ festivalId: prompt.festivalId, day: prompt.day })
          .catch((error: unknown) => {
            logger.warn("Failed to record feedback prompt dismissal:", { error });
          });
      }
    },
    [prompt, dismissPrompt],
  );

  if (!prompt) {
    return null;
  }

  return (
    <FeedbackSheet
      isOpen={isOpen}
      mode={{
        kind: "day",
        festivalId: prompt.festivalId,
        festivalName: prompt.festivalName,
        day: prompt.day,
      }}
      onClose={handleClose}
    />
  );
}
