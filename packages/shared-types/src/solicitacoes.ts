import { z } from "zod";
import { statusUpdateSchema } from "./status-update";

export const AdjustmentRequestInputSchema = z.object({
  reason: z.string().min(1),
});
export type AdjustmentRequestInput = z.infer<typeof AdjustmentRequestInputSchema>;

export const AdjustmentStatusUpdateSchema = statusUpdateSchema();
export type AdjustmentStatusUpdate = z.infer<typeof AdjustmentStatusUpdateSchema>;

export const CompensationRequestInputSchema = z.object({
  reason: z.string().min(1),
});
export type CompensationRequestInput = z.infer<typeof CompensationRequestInputSchema>;

export const CompensationStatusUpdateSchema = statusUpdateSchema();
export type CompensationStatusUpdate = z.infer<typeof CompensationStatusUpdateSchema>;

export const VacationRequestInputSchema = z.object({
  startDate: z.string().date(),
  endDate: z.string().date(),
  days: z.number().int().positive(),
});
export type VacationRequestInput = z.infer<typeof VacationRequestInputSchema>;

export const VacationStatusUpdateSchema = statusUpdateSchema();
export type VacationStatusUpdate = z.infer<typeof VacationStatusUpdateSchema>;
