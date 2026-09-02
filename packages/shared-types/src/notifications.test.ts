import { PAGAMENTO_CATEGORIAS, SendPagamentoSchema } from "./notifications";

describe("PAGAMENTO_CATEGORIAS", () => {
  it("has exactly the four payment categories", () => {
    expect(PAGAMENTO_CATEGORIAS).toEqual([
      "salario",
      "auxilio_home_office",
      "vale_transporte",
      "vale_alimentacao",
    ]);
  });
});

describe("SendPagamentoSchema", () => {
  it("accepts a valid category with one or more userIds", () => {
    const result = SendPagamentoSchema.safeParse({
      category: "vale_transporte",
      userIds: ["user-1", "user-2"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid category", () => {
    const result = SendPagamentoSchema.safeParse({
      category: "bonus",
      userIds: ["user-1"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty userIds array", () => {
    const result = SendPagamentoSchema.safeParse({
      category: "salario",
      userIds: [],
    });
    expect(result.success).toBe(false);
  });
});
