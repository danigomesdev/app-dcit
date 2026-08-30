import { z } from "zod";

export const PayslipInputSchema = z.object({
  userId: z.string().min(1),
  label: z.string().min(1),
  // z.coerce (não z.number()): o formulário web manda esses campos via
  // FormData → Server Action → JSON.stringify, então chegam como string
  // ("6200", não 6200) — mesmo raciocínio de expectedDailyMinutes em
  // convencao.ts.
  gross: z.coerce.number().nonnegative(),
  inss: z.coerce.number().nonnegative(),
  irrf: z.coerce.number().nonnegative(),
  benefits: z.coerce.number().nonnegative(),
});
export type PayslipInput = z.infer<typeof PayslipInputSchema>;

// Sem userId: um holerite não muda de dono depois de criado.
export const PayslipUpdateSchema = PayslipInputSchema.omit({ userId: true });
export type PayslipUpdate = z.infer<typeof PayslipUpdateSchema>;
