import { z } from "zod";

export const reservationSchema = z.object({
  tentId: z.string().min(1, "Please select a tent"),
  startAt: z.date({ error: "Please select a date and time" }),
  reminderOffsetMinutes: z
    .number()
    .min(0, "Reminder offset cannot be negative"),
  visibleToGroups: z.boolean(),
});

export type ReservationFormData = z.infer<typeof reservationSchema>;
