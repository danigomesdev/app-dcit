import { RoleSchema } from "./role";

describe("RoleSchema", () => {
  it("accepts each known role", () => {
    for (const role of ["colaborador", "gestor", "rh"]) {
      expect(RoleSchema.safeParse(role).success).toBe(true);
    }
  });

  it("rejects an unknown role", () => {
    expect(RoleSchema.safeParse("admin").success).toBe(false);
  });
});
