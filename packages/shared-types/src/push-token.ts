import { z } from "zod";

export const PushTokenInputSchema = z.object({
  token: z.string().min(1),
});
export type PushTokenInput = z.infer<typeof PushTokenInputSchema>;
