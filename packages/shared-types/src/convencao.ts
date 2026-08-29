import { z } from "zod";

export const ConvencaoInputSchema = z.object({
  nome: z.string().min(1),
  cnpj: z.string().min(1).nullable(),
  categoriaSindical: z.string().min(1).nullable(),
  // z.coerce (não z.number()): o formulário web manda esses campos via
  // FormData → Server Action → JSON.stringify, então chegam como string
  // ("480", não 480).
  expectedDailyMinutes: z.coerce.number().int().positive(),
  overtimePercent: z.coerce.number().nonnegative(),
});
export type ConvencaoInput = z.infer<typeof ConvencaoInputSchema>;
