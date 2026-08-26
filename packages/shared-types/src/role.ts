import { z } from "zod";

export const RoleSchema = z.enum(["colaborador", "gestor", "rh"]);
export type Role = z.infer<typeof RoleSchema>;
