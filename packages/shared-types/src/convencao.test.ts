import { ConvencaoInputSchema } from "./convencao";

const VALID_PAYLOAD = {
  nome: "Convenção Sindicato dos Metalúrgicos",
  cnpj: "12345678000199",
  categoriaSindical: "Metalúrgicos",
  expectedDailyMinutes: 480,
  overtimePercent: 50,
};

describe("ConvencaoInputSchema", () => {
  it("accepts a fully populated valid payload", () => {
    const result = ConvencaoInputSchema.safeParse(VALID_PAYLOAD);
    expect(result.success).toBe(true);
  });

  it("accepts cnpj and categoriaSindical as null", () => {
    const result = ConvencaoInputSchema.safeParse({
      ...VALID_PAYLOAD,
      cnpj: null,
      categoriaSindical: null,
    });
    expect(result.success).toBe(true);
  });

  it("coerces expectedDailyMinutes and overtimePercent from strings (form submissions)", () => {
    const result = ConvencaoInputSchema.safeParse({
      ...VALID_PAYLOAD,
      expectedDailyMinutes: "480",
      overtimePercent: "50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expectedDailyMinutes).toBe(480);
      expect(result.data.overtimePercent).toBe(50);
    }
  });

  it("rejects a missing nome", () => {
    const { nome: _nome, ...rest } = VALID_PAYLOAD;
    const result = ConvencaoInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a zero or negative expectedDailyMinutes", () => {
    const result = ConvencaoInputSchema.safeParse({ ...VALID_PAYLOAD, expectedDailyMinutes: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects an expectedDailyMinutes greater than 1440 (a full day)", () => {
    const result = ConvencaoInputSchema.safeParse({ ...VALID_PAYLOAD, expectedDailyMinutes: 1441 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative overtimePercent", () => {
    const result = ConvencaoInputSchema.safeParse({ ...VALID_PAYLOAD, overtimePercent: -10 });
    expect(result.success).toBe(false);
  });
});
