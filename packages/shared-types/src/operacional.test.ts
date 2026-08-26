import { DeslocamentoInputSchema } from "./operacional";

describe("DeslocamentoInputSchema", () => {
  it("accepts a valid ISO datetime range", () => {
    const result = DeslocamentoInputSchema.safeParse({
      startedAt: "2026-08-20T10:00:00.000Z",
      endedAt: "2026-08-20T10:30:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a date-only string", () => {
    const result = DeslocamentoInputSchema.safeParse({
      startedAt: "2026-08-20",
      endedAt: "2026-08-20T10:30:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});
