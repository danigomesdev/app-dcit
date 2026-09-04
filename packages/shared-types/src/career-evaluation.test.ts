import { CareerEvaluationSaveSchema, CareerEvaluationDecidirSchema } from "./career-evaluation";
import { PRINCIPIO_KEYS, COMPETENCIA_KEYS } from "./career-ladder";

const VALID_INPUT = {
  userId: "user-1",
  principios: PRINCIPIO_KEYS.map((principio) => ({ principio, nota: 8, justificativa: "Boa evolução." })),
  competencias: COMPETENCIA_KEYS.map((competencia) => ({ competencia, nota: 7 })),
  requisitosAtendidos: ["Graduação completa"],
};

describe("CareerEvaluationSaveSchema", () => {
  it("accepts a fully populated valid payload", () => {
    expect(CareerEvaluationSaveSchema.safeParse(VALID_INPUT).success).toBe(true);
  });

  it("rejects a principios array missing an entry", () => {
    const result = CareerEvaluationSaveSchema.safeParse({
      ...VALID_INPUT,
      principios: VALID_INPUT.principios.slice(1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a nota above 10", () => {
    const result = CareerEvaluationSaveSchema.safeParse({
      ...VALID_INPUT,
      competencias: [{ ...VALID_INPUT.competencias[0], nota: 11 }, ...VALID_INPUT.competencias.slice(1)],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown principio key", () => {
    const result = CareerEvaluationSaveSchema.safeParse({
      ...VALID_INPUT,
      principios: [{ principio: "not-a-real-key", nota: 8 }, ...VALID_INPUT.principios.slice(1)],
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty requisitosAtendidos array", () => {
    expect(CareerEvaluationSaveSchema.safeParse({ ...VALID_INPUT, requisitosAtendidos: [] }).success).toBe(true);
  });
});

describe("CareerEvaluationDecidirSchema", () => {
  it("accepts confirmarPromocao true/false", () => {
    expect(CareerEvaluationDecidirSchema.safeParse({ confirmarPromocao: true }).success).toBe(true);
    expect(CareerEvaluationDecidirSchema.safeParse({ confirmarPromocao: false }).success).toBe(true);
  });

  it("rejects a missing confirmarPromocao", () => {
    expect(CareerEvaluationDecidirSchema.safeParse({}).success).toBe(false);
  });
});
