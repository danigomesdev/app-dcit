import { z } from "zod";

export const EscalaShiftInputSchema = z.object({
  date: z.string().date(),
  label: z.string().min(1),
  userId: z.string().min(1),
});
export type EscalaShiftInput = z.infer<typeof EscalaShiftInputSchema>;
