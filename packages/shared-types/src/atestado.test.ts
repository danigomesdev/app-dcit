import { AtestadoOcrRequestSchema, AtestadoOcrResultSchema } from "./atestado";

describe("AtestadoOcrRequestSchema", () => {
  it("accepts a valid payload", () => {
    const result = AtestadoOcrRequestSchema.safeParse({
      imageBase64: "aGVsbG8=",
      mediaType: "image/jpeg",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty image", () => {
    const result = AtestadoOcrRequestSchema.safeParse({
      imageBase64: "",
      mediaType: "image/jpeg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported media type", () => {
    const result = AtestadoOcrRequestSchema.safeParse({
      imageBase64: "aGVsbG8=",
      mediaType: "application/pdf",
    });
    expect(result.success).toBe(false);
  });
});

describe("AtestadoOcrResultSchema", () => {
  it("accepts a fully populated result", () => {
    const result = AtestadoOcrResultSchema.safeParse({
      cid: "J06.9",
      crm: "CRM-MG 45213",
      medico: "Dr. Carlos Mendes",
      dias: 2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a result with unreadable fields as null", () => {
    const result = AtestadoOcrResultSchema.safeParse({
      cid: null,
      crm: null,
      medico: null,
      dias: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-integer dias", () => {
    const result = AtestadoOcrResultSchema.safeParse({
      cid: null,
      crm: null,
      medico: null,
      dias: 2.5,
    });
    expect(result.success).toBe(false);
  });
});
