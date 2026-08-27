import {
  AdjustmentRequestInputSchema,
  AdjustmentStatusUpdateSchema,
  CompensationRequestInputSchema,
  CompensationStatusUpdateSchema,
  VacationRequestInputSchema,
  VacationStatusUpdateSchema,
} from "./solicitacoes";

describe("AdjustmentRequestInputSchema", () => {
  it("accepts a non-empty reason", () => {
    expect(AdjustmentRequestInputSchema.safeParse({ reason: "Esqueci de bater o ponto" }).success).toBe(
      true,
    );
  });

  it("rejects an empty reason", () => {
    expect(AdjustmentRequestInputSchema.safeParse({ reason: "" }).success).toBe(false);
  });
});

describe("CompensationRequestInputSchema", () => {
  it("accepts a non-empty reason", () => {
    expect(CompensationRequestInputSchema.safeParse({ reason: "Compensar 2h" }).success).toBe(true);
  });

  it("rejects a missing reason", () => {
    expect(CompensationRequestInputSchema.safeParse({}).success).toBe(false);
  });
});

describe("VacationRequestInputSchema", () => {
  it("accepts a valid date-only range with positive days", () => {
    const result = VacationRequestInputSchema.safeParse({
      startDate: "2026-10-05",
      endDate: "2026-10-14",
      days: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a full ISO datetime instead of a plain date", () => {
    const result = VacationRequestInputSchema.safeParse({
      startDate: "2026-10-05T00:00:00.000Z",
      endDate: "2026-10-14",
      days: 10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive days value", () => {
    const result = VacationRequestInputSchema.safeParse({
      startDate: "2026-10-05",
      endDate: "2026-10-14",
      days: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("VacationStatusUpdateSchema", () => {
  it("accepts aprovado and recusado", () => {
    expect(VacationStatusUpdateSchema.safeParse({ status: "aprovado" }).success).toBe(true);
    expect(VacationStatusUpdateSchema.safeParse({ status: "recusado" }).success).toBe(true);
  });

  it("rejects any other status value", () => {
    expect(VacationStatusUpdateSchema.safeParse({ status: "pendente" }).success).toBe(false);
  });
});

describe("AdjustmentStatusUpdateSchema", () => {
  it("accepts aprovado and recusado", () => {
    expect(AdjustmentStatusUpdateSchema.safeParse({ status: "aprovado" }).success).toBe(true);
    expect(AdjustmentStatusUpdateSchema.safeParse({ status: "recusado" }).success).toBe(true);
  });

  it("rejects any other status value", () => {
    expect(AdjustmentStatusUpdateSchema.safeParse({ status: "pendente" }).success).toBe(false);
  });
});

describe("CompensationStatusUpdateSchema", () => {
  it("accepts aprovado and recusado", () => {
    expect(CompensationStatusUpdateSchema.safeParse({ status: "aprovado" }).success).toBe(true);
    expect(CompensationStatusUpdateSchema.safeParse({ status: "recusado" }).success).toBe(true);
  });

  it("rejects any other status value", () => {
    expect(CompensationStatusUpdateSchema.safeParse({ status: "pendente" }).success).toBe(false);
  });
});
