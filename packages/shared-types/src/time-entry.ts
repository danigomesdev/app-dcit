import { z } from "zod";

export const TimeEntryInputSchema = z.object({
  userId: z.string().min(1),
  clockedAt: z.string().datetime(),
});

export type TimeEntryInput = z.infer<typeof TimeEntryInputSchema>;
