import { AdmissionDocumentInputSchema, CertificationInputSchema } from "./documentos";

describe("AdmissionDocumentInputSchema", () => {
  it("accepts a title with no photo", () => {
    expect(AdmissionDocumentInputSchema.safeParse({ title: "Comprovante" }).success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(AdmissionDocumentInputSchema.safeParse({ title: "" }).success).toBe(false);
  });
});

describe("CertificationInputSchema", () => {
  it("accepts a valid DD/MM/AAAA date", () => {
    const result = CertificationInputSchema.safeParse({
      name: "AWS Certified",
      institution: "Amazon",
      validUntil: "10/10/2028",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an ISO date instead of DD/MM/AAAA", () => {
    const result = CertificationInputSchema.safeParse({
      name: "AWS Certified",
      institution: "Amazon",
      validUntil: "2028-10-10",
    });
    expect(result.success).toBe(false);
  });
});
