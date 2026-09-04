import { MuralPostInputSchema } from "./mural";

const VALID_INPUT = {
  glyph: "🎉",
  title: "Boas-vindas!",
  body: "Damos as boas-vindas ao novo time de suporte.",
};

describe("MuralPostInputSchema", () => {
  it("accepts a fully populated valid payload", () => {
    const result = MuralPostInputSchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it("rejects an empty glyph", () => {
    const result = MuralPostInputSchema.safeParse({ ...VALID_INPUT, glyph: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty title", () => {
    const result = MuralPostInputSchema.safeParse({ ...VALID_INPUT, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty body", () => {
    const result = MuralPostInputSchema.safeParse({ ...VALID_INPUT, body: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing title", () => {
    const { title: _title, ...rest } = VALID_INPUT;
    const result = MuralPostInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
