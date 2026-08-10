import { useTranslation } from "@prostcounter/shared/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Tab } from "@/components/ui/segmented-control";
import {
  type AttendanceViewMode,
  DEFAULT_ATTENDANCE_VIEW_MODE,
  getAttendanceViewMode,
  isAttendanceViewMode,
  setAttendanceViewMode,
} from "@/lib/attendance-view-storage";
import { logger } from "@/lib/logger";

interface UseAttendanceViewModeResult {
  viewMode: AttendanceViewMode | null;
  setViewMode: (key: string) => void;
  viewTabs: Tab[];
}

/**
 * Hydrates and persists the attendance tab's view mode (strip vs list).
 *
 * View mode is hydrated before first paint (callers should gate their loading
 * state on `viewMode === null`) so a user who chose "list" never sees the
 * calendar flash first.
 */
export function useAttendanceViewMode(): UseAttendanceViewModeResult {
  const { t } = useTranslation();

  const [viewMode, setViewModeState] = useState<AttendanceViewMode | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fallbackTimerId = setTimeout(() => {
      if (isMounted) {
        setViewModeState(DEFAULT_ATTENDANCE_VIEW_MODE);
      }
    }, 1000);

    getAttendanceViewMode().then((storedMode) => {
      if (isMounted) {
        clearTimeout(fallbackTimerId);
        setViewModeState(storedMode);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimerId);
    };
  }, []);

  const handleViewModeChange = useCallback((key: string) => {
    // SegmentedControl hands back a plain string, so narrow rather than cast:
    // persisting an unknown key would leave the control with no active segment.
    if (!isAttendanceViewMode(key)) {
      logger.warn("Ignoring unknown attendance view mode", { key });
      return;
    }
    setViewModeState(key);
    setAttendanceViewMode(key).catch((error) => {
      logger.error("Failed to persist attendance view mode:", error);
    });
  }, []);

  const viewTabs = useMemo(
    (): Tab[] => [
      { key: "calendar", label: t("attendance.view.calendar") },
      { key: "list", label: t("attendance.view.list") },
    ],
    [t],
  );

  return { viewMode, setViewMode: handleViewModeChange, viewTabs };
}
