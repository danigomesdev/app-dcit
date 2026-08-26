import { z } from "zod";

export const AdjustmentRequestInputSchema = z.object({
  reason: z.string().min(1),
});
export type AdjustmentRequestInput = z.infer<typeof AdjustmentRequestInputSchema>;

export const CompensationRequestInputSchema = z.object({
  reason: z.string().min(1),
});
export type CompensationRequestInput = z.infer<typeof CompensationRequestInputSchema>;

export const VacationRequestInputSchema = z.object({
  startDate: z.string().date(),
  endDate: z.string().date(),
  days: z.number().int().positive(),
});
export type VacationRequestInput = z.infer<typeof VacationRequestInputSchema>;

export const VacationStatusUpdateSchema = z.object({
  status: z.enum(["aprovado", "recusado"]),
});
export type VacationStatusUpdate = z.infer<typeof VacationStatusUpdateSchema>;
