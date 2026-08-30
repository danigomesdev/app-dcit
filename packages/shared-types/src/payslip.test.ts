import { PayslipInputSchema, PayslipUpdateSchema } from "./payslip";

const VALID_INPUT = {
  userId: "user-1",
  label: "Agosto/2026",
  gross: 6200,
  inss: 682,
  irrf: 410,
  benefits: 380,
};

describe("PayslipInputSchema", () => {
  it("accepts a fully populated valid payload", () => {
    const result = PayslipInputSchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it("coerces monetary fields from strings (form submissions)", () => {
    const result = PayslipInputSchema.safeParse({
      ...VALID_INPUT,
      gross: "6200",
      inss: "682",
      irrf: "410",
      benefits: "380",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gross).toBe(6200);
      expect(result.data.benefits).toBe(380);
    }
  });

  it("rejects a missing userId", () => {
    const { userId: _userId, ...rest } = VALID_INPUT;
    const result = PayslipInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects an empty label", () => {
    const result = PayslipInputSchema.safeParse({ ...VALID_INPUT, label: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative gross value", () => {
    const result = PayslipInputSchema.safeParse({ ...VALID_INPUT, gross: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative inss/irrf/benefits value", () => {
    expect(PayslipInputSchema.safeParse({ ...VALID_INPUT, inss: -1 }).success).toBe(false);
    expect(PayslipInputSchema.safeParse({ ...VALID_INPUT, irrf: -1 }).success).toBe(false);
    expect(PayslipInputSchema.safeParse({ ...VALID_INPUT, benefits: -1 }).success).toBe(false);
  });
});

describe("PayslipUpdateSchema", () => {
  it("accepts the same payload without userId", () => {
    const { userId: _userId, ...rest } = VALID_INPUT;
    const result = PayslipUpdateSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("ignores a userId field if present (not part of the schema's shape)", () => {
    const result = PayslipUpdateSchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).userId).toBeUndefined();
    }
  });

  it("rejects a negative gross value", () => {
    const { userId: _userId, ...rest } = VALID_INPUT;
    const result = PayslipUpdateSchema.safeParse({ ...rest, gross: -100 });
    expect(result.success).toBe(false);
  });
});
