import { z } from "zod";

export const DeslocamentoInputSchema = z.object({
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
});
export type DeslocamentoInput = z.infer<typeof DeslocamentoInputSchema>;
