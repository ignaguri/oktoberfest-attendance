import { BEGINNING_OF_WIESN, END_OF_WIESN, TIMEZONE } from "@/lib/constants";
import { TZDate } from "@date-fns/tz";
import { add } from "date-fns";
import { z } from "zod";

const DAY_AFTER_WIESN = add(new TZDate(END_OF_WIESN, TIMEZONE), { days: 1 });

export const quickAttendanceSchema = z.object({
  tentId: z.string().min(1, "Please select a tent"),
  beerCount: z.number().min(0, "Beer count cannot be negative"),
});

export const detailedAttendanceSchema = z
  .object({
    amount: z.number().min(0, "Beer count cannot be negative"),
    date: z
      .date()
      .min(BEGINNING_OF_WIESN, "Wrong date: Wiesn hadn't started")
      .max(DAY_AFTER_WIESN, "Wrong date: Sadly it's over"),
    tents: z.array(z.string()),
  })
  .refine(
    (data) => {
      // Must select at least one tent if beer count is 0
      return data.amount !== 0 || (data.amount === 0 && data.tents.length > 0);
    },
    {
      message: "Must select at least one tent if beer count is 0",
      path: ["amount"],
    },
  );

export type QuickAttendanceFormData = z.infer<typeof quickAttendanceSchema>;
export type DetailedAttendanceFormData = z.infer<
  typeof detailedAttendanceSchema
>;
