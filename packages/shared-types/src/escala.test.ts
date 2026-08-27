import { EscalaShiftInputSchema } from "./escala";

describe("EscalaShiftInputSchema", () => {
  it("accepts a valid date-only shift assignment", () => {
    const result = EscalaShiftInputSchema.safeParse({
      date: "2026-09-01",
      label: "Manhã",
      userId: "colaborador-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a full ISO datetime instead of a plain date", () => {
    const result = EscalaShiftInputSchema.safeParse({
      date: "2026-09-01T00:00:00.000Z",
      label: "Manhã",
      userId: "colaborador-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty label", () => {
    const result = EscalaShiftInputSchema.safeParse({
      date: "2026-09-01",
      label: "",
      userId: "colaborador-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty userId", () => {
    const result = EscalaShiftInputSchema.safeParse({
      date: "2026-09-01",
      label: "Manhã",
      userId: "",
    });
    expect(result.success).toBe(false);
  });
});
