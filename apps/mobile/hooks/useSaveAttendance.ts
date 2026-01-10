/**
 * Hook for saving attendance with photos
 *
 * Orchestrates the complete save flow:
 * 1. Update attendance record
 * 2. Delete photos marked for removal
 * 3. Upload pending photos
 * 4. Invalidate relevant caches
 */

import { useInvalidateQueries, QueryKeys } from "@prostcounter/shared/data";
import { useUpdatePersonalAttendance } from "@prostcounter/shared/hooks";
import { format } from "date-fns";
import { useCallback, useState } from "react";

import {
  useBeerPictureUpload,
  type PendingPhoto,
} from "./useBeerPictureUpload";
import { apiClient } from "@/lib/api-client";

interface SaveAttendanceInput {
  festivalId: string;
  date: Date;
  amount: number;
  tents: string[];
  existingAttendanceId?: string;
  pendingPhotos: PendingPhoto[];
  photosToDelete: string[];
}

interface UseSaveAttendanceReturn {
  saveAttendance: (input: SaveAttendanceInput) => Promise<void>;
  isSaving: boolean;
  error: Error | null;
}

export function useSaveAttendance(): UseSaveAttendanceReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateAttendance = useUpdatePersonalAttendance();
  const { uploadPendingPhotos } = useBeerPictureUpload();
  const invalidateQueries = useInvalidateQueries();

  const saveAttendance = useCallback(
    async (input: SaveAttendanceInput) => {
      const {
        festivalId,
        date,
        amount,
        tents,
        existingAttendanceId,
        pendingPhotos,
        photosToDelete,
      } = input;

      setIsSaving(true);
      setError(null);

      try {
        const dateStr = format(date, "yyyy-MM-dd");

        // Step 1: Update attendance record
        const result = await updateAttendance.mutateAsync({
          festivalId,
          date: dateStr,
          amount,
          tents,
        });

        // Step 2: Delete photos marked for removal
        if (photosToDelete.length > 0) {
          await Promise.all(
            photosToDelete.map(async (photoId) => {
              try {
                await apiClient.photos.delete(photoId);
              } catch (deleteError) {
                console.warn("Failed to delete photo:", photoId, deleteError);
                // Continue with other operations even if deletion fails
              }
            }),
          );
        }

        // Step 3: Upload pending photos
        if (pendingPhotos.length > 0) {
          const attendanceId = existingAttendanceId || result?.attendanceId;

          if (attendanceId) {
            await uploadPendingPhotos({
              festivalId,
              attendanceId,
              pendingPhotos,
            });
          }
        }

        // Step 4: Invalidate caches
        invalidateQueries(QueryKeys.attendanceByDate(festivalId, dateStr));
      } catch (err) {
        const saveError =
          err instanceof Error ? err : new Error("Failed to save attendance");
        setError(saveError);
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [updateAttendance, uploadPendingPhotos, invalidateQueries],
  );

  return {
    saveAttendance,
    isSaving,
    error,
  };
}
