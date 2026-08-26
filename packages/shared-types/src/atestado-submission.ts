import { z } from "zod";

export const AtestadoInputSchema = z.object({
  cid: z.string().min(1),
  crm: z.string().min(1),
  medico: z.string().min(1),
  dias: z.number().int().positive(),
  photoUri: z.string().optional(),
});
export type AtestadoInput = z.infer<typeof AtestadoInputSchema>;

export const AtestadoStatusUpdateSchema = z.object({
  status: z.enum(["aprovado", "recusado"]),
});
export type AtestadoStatusUpdate = z.infer<typeof AtestadoStatusUpdateSchema>;
