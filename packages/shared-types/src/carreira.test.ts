import {
  CareerGoalCreateSchema,
  TrackRequirementCreateSchema,
  PerformanceEvaluationCreateSchema,
  NineBoxPlacementCreateSchema,
  OneOnOneCreateSchema,
  OneOnOneAcaoUpdateSchema,
} from "./carreira";

describe("CareerGoalCreateSchema", () => {
  it("accepts a valid pdi goal", () => {
    const result = CareerGoalCreateSchema.safeParse({
      userId: "user-1",
      tipo: "pdi",
      title: "Tirar certificação Azure",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid tipo", () => {
    const result = CareerGoalCreateSchema.safeParse({
      userId: "user-1",
      tipo: "okr",
      title: "x",
    });
    expect(result.success).toBe(false);
  });
});

describe("TrackRequirementCreateSchema", () => {
  it("rejects an empty title", () => {
    const result = TrackRequirementCreateSchema.safeParse({ userId: "user-1", title: "" });
    expect(result.success).toBe(false);
  });
});

describe("PerformanceEvaluationCreateSchema", () => {
  it("rejects a score above 5", () => {
    const result = PerformanceEvaluationCreateSchema.safeParse({
      userId: "user-1",
      proatividade: 6,
      trabalhoEquipe: 5,
      comunicacao: 5,
      lideranca: 5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts all scores at the boundary values 1 and 5", () => {
    const result = PerformanceEvaluationCreateSchema.safeParse({
      userId: "user-1",
      proatividade: 1,
      trabalhoEquipe: 5,
      comunicacao: 1,
      lideranca: 5,
    });
    expect(result.success).toBe(true);
  });
});

describe("NineBoxPlacementCreateSchema", () => {
  it("rejects an invalid eixo value", () => {
    const result = NineBoxPlacementCreateSchema.safeParse({
      userId: "user-1",
      desempenho: "excelente",
      potencial: "alto",
    });
    expect(result.success).toBe(false);
  });
});

describe("OneOnOneCreateSchema", () => {
  it("defaults acoes to an empty array", () => {
    const result = OneOnOneCreateSchema.safeParse({ userId: "user-1", pauta: "Conversa mensal" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.acoes).toEqual([]);
  });
});

describe("OneOnOneAcaoUpdateSchema", () => {
  it("rejects an invalid status", () => {
    const result = OneOnOneAcaoUpdateSchema.safeParse({ status: "em_andamento" });
    expect(result.success).toBe(false);
  });
});
