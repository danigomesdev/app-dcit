import { z } from "zod";

import { PRINCIPIO_KEYS, COMPETENCIA_KEYS } from "./career-ladder";

export const CareerEvaluationSaveSchema = z.object({
  userId: z.string().min(1),
  principios: z
    .array(
      z.object({
        principio: z.enum(PRINCIPIO_KEYS),
        nota: z.number().int().min(0).max(10),
        justificativa: z.string().optional(),
      }),
    )
    .length(PRINCIPIO_KEYS.length),
  competencias: z
    .array(
      z.object({
        competencia: z.enum(COMPETENCIA_KEYS),
        nota: z.number().int().min(0).max(10),
      }),
    )
    .length(COMPETENCIA_KEYS.length),
  requisitosAtendidos: z.array(z.string()),
});
export type CareerEvaluationSaveInput = z.infer<typeof CareerEvaluationSaveSchema>;

export const CareerEvaluationDecidirSchema = z.object({
  confirmarPromocao: z.boolean(),
});
export type CareerEvaluationDecidirInput = z.infer<typeof CareerEvaluationDecidirSchema>;
