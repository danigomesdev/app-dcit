import { z } from "zod";

export const CAREER_GOAL_TIPOS = ["pdi", "entrega"] as const;
export const STATUS_TAREFA = ["pendente", "andamento", "concluida"] as const;
export const STATUS_REQUISITO = ["pendente", "andamento", "concluido"] as const;
export const NIVEL_NINE_BOX = ["baixo", "medio", "alto"] as const;
export const STATUS_ACAO = ["pendente", "concluido"] as const;

export const CareerGoalCreateSchema = z.object({
  userId: z.string().min(1),
  tipo: z.enum(CAREER_GOAL_TIPOS),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});
export type CareerGoalCreateInput = z.infer<typeof CareerGoalCreateSchema>;

export const CareerGoalUpdateSchema = z.object({
  status: z.enum(STATUS_TAREFA),
});
export type CareerGoalUpdateInput = z.infer<typeof CareerGoalUpdateSchema>;

export const TrackRequirementCreateSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
});
export type TrackRequirementCreateInput = z.infer<typeof TrackRequirementCreateSchema>;

export const TrackRequirementUpdateSchema = z.object({
  status: z.enum(STATUS_REQUISITO),
});
export type TrackRequirementUpdateInput = z.infer<typeof TrackRequirementUpdateSchema>;

export const PerformanceEvaluationCreateSchema = z.object({
  userId: z.string().min(1),
  proatividade: z.number().int().min(1).max(5),
  trabalhoEquipe: z.number().int().min(1).max(5),
  comunicacao: z.number().int().min(1).max(5),
  lideranca: z.number().int().min(1).max(5),
  comentario: z.string().optional(),
});
export type PerformanceEvaluationCreateInput = z.infer<typeof PerformanceEvaluationCreateSchema>;

export const NineBoxPlacementCreateSchema = z.object({
  userId: z.string().min(1),
  desempenho: z.enum(NIVEL_NINE_BOX),
  potencial: z.enum(NIVEL_NINE_BOX),
});
export type NineBoxPlacementCreateInput = z.infer<typeof NineBoxPlacementCreateSchema>;

export const OneOnOneCreateSchema = z.object({
  userId: z.string().min(1),
  pauta: z.string().min(1),
  proximaData: z.string().datetime().optional(),
  acoes: z.array(z.object({ descricao: z.string().min(1) })).default([]),
});
export type OneOnOneCreateInput = z.infer<typeof OneOnOneCreateSchema>;

export const OneOnOneAcaoUpdateSchema = z.object({
  status: z.enum(STATUS_ACAO),
});
export type OneOnOneAcaoUpdateInput = z.infer<typeof OneOnOneAcaoUpdateSchema>;
