import { z } from "zod";

export const PERIODOS_HORAS = ["dia", "semana", "mes"] as const;
export const PeriodoHorasSchema = z.enum(PERIODOS_HORAS);

export const WorkedHoursEntryCreateSchema = z.object({
  userId: z.string().min(1),
  date: z.string().date(),
  horasTrabalhadas: z.number().min(0),
  horasTickets: z.number().min(0),
});

export type PeriodoHoras = z.infer<typeof PeriodoHorasSchema>;
export type WorkedHoursEntryCreateInput = z.infer<typeof WorkedHoursEntryCreateSchema>;
