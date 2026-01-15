/**
 * Hook for saving attendance with photos and consumption sync
 *
 * Orchestrates the complete save flow:
 * 1. Update attendance record
 * 2. Sync consumptions (create/delete based on delta)
 * 3. Delete photos marked for removal
 * 4. Upload pending photos
 * 5. Invalidate relevant caches
 */

import { useInvalidateQueries, QueryKeys } from "@prostcounter/shared/data";
import {
  useUpdatePersonalAttendance,
  useLogConsumption,
  useDeleteConsumption,
} from "@prostcounter/shared/hooks";
import type { DrinkType, Consumption } from "@prostcounter/shared/schemas";
import { format } from "date-fns";
import { useCallback, useState } from "react";

import {
  useBeerPictureUpload,
  type PendingPhoto,
} from "./useBeerPictureUpload";
import { useDrinkPrice } from "./useDrinkPrice";
import { apiClient } from "@/lib/api-client";

interface SaveAttendanceInput {
  festivalId: string;
  date: Date;
  amount: number;
  tents: string[];
  existingAttendanceId?: string;
  pendingPhotos: PendingPhoto[];
  photosToDelete: string[];
  // New: Consumption sync data
  localDrinkCounts?: Record<DrinkType, number>;
  existingConsumptions?: Consumption[];
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
  const logConsumption = useLogConsumption();
  const deleteConsumption = useDeleteConsumption();
  const { uploadPendingPhotos } = useBeerPictureUpload();
  const { getDrinkPriceCents } = useDrinkPrice();
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
        localDrinkCounts,
        existingConsumptions,
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

        // Step 2: Sync consumptions if local counts provided
        if (localDrinkCounts && existingConsumptions) {
          // Calculate current counts from existing consumptions
          const currentCounts: Record<DrinkType, number> = {
            beer: 0,
            radler: 0,
            wine: 0,
            soft_drink: 0,
            alcohol_free: 0,
            other: 0,
          };
          for (const c of existingConsumptions) {
            if (currentCounts[c.drinkType] !== undefined) {
              currentCounts[c.drinkType]++;
            }
          }

          // Process each drink type
          for (const drinkType of Object.keys(
            localDrinkCounts,
          ) as DrinkType[]) {
            const desiredCount = localDrinkCounts[drinkType];
            const currentCount = currentCounts[drinkType];
            const delta = desiredCount - currentCount;

            if (delta > 0) {
              // Need to create more consumptions
              const tentId = tents[0]; // Use first tent
              const priceCents = getDrinkPriceCents(drinkType, tentId);
              for (let i = 0; i < delta; i++) {
                await logConsumption.mutateAsync({
                  festivalId,
                  date: dateStr,
                  drinkType,
                  tentId,
                  pricePaidCents: priceCents,
                  volumeMl: 1000,
                });
              }
            } else if (delta < 0) {
              // Need to delete some consumptions
              const consumptionsOfType = existingConsumptions
                .filter((c) => c.drinkType === drinkType)
                .sort(
                  (a, b) =>
                    new Date(b.recordedAt).getTime() -
                    new Date(a.recordedAt).getTime(),
                );

              for (let i = 0; i < Math.abs(delta); i++) {
                const toDelete = consumptionsOfType[i];
                if (toDelete) {
                  await deleteConsumption.mutateAsync(toDelete.id);
                }
              }
            }
          }
        }

        // Step 3: Delete photos marked for removal
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

        // Step 4: Upload pending photos
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

        // Step 5: Invalidate caches
        invalidateQueries(QueryKeys.attendanceByDate(festivalId, dateStr));
        invalidateQueries(QueryKeys.consumptions(festivalId, dateStr));
      } catch (err) {
        const saveError =
          err instanceof Error ? err : new Error("Failed to save attendance");
        setError(saveError);
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [
      updateAttendance,
      logConsumption,
      deleteConsumption,
      uploadPendingPhotos,
      getDrinkPriceCents,
      invalidateQueries,
    ],
  );

  return {
    saveAttendance,
    isSaving,
    error,
  };
}
