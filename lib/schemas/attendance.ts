import { TIMEZONE } from "@/lib/constants";
import { TZDate } from "@date-fns/tz";
import { add } from "date-fns";
import { z } from "zod";

export const quickAttendanceSchema = z.object({
  tentId: z.string(),
  beerCount: z.number().min(0, "Beer count cannot be negative"),
});

// Factory function to create detailed attendance schema with dynamic festival dates
export function createDetailedAttendanceSchema(
  festivalStartDate: Date,
  festivalEndDate: Date,
) {
  const dayAfterFestival = add(new TZDate(festivalEndDate, TIMEZONE), {
    days: 1,
  });

  return z
    .object({
      amount: z.number().min(0, "Beer count cannot be negative"),
      date: z
        .date()
        .min(festivalStartDate, "Wrong date: Festival hasn't started")
        .max(dayAfterFestival, "Wrong date: Sadly it's over"),
      tents: z.array(z.string()),
    })
    .refine(
      (data) => {
        // Must select at least one tent if beer count is 0
        return (
          data.amount !== 0 || (data.amount === 0 && data.tents.length > 0)
        );
      },
      {
        message: "Must select at least one tent if beer count is 0",
        path: ["amount"],
      },
    );
}

export type QuickAttendanceFormData = z.infer<typeof quickAttendanceSchema>;
export type DetailedAttendanceFormData = z.infer<
  ReturnType<typeof createDetailedAttendanceSchema>
>;
