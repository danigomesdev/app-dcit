import { z } from "zod";

import { RoleSchema } from "./role";

export const ESTADOS_CIVIS = [
  "solteiro",
  "casado",
  "divorciado",
  "viuvo",
  "uniao_estavel",
] as const;

// As 27 UFs do Brasil — lista fixa, mesmo raciocínio de ESTADOS_CIVIS: evitar
// dado sujo ("ZZ" não deve ser um estado válido).
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;

export const EmployeeCreateSchema = z.object({
  name: z.string().min(1),
  role: RoleSchema,
  hireDate: z.string().date(),
  cpf: z.string().regex(/^\d{11}$/).nullable(),
  rg: z.string().min(1).nullable(),
  dataNascimento: z.string().date().nullable(),
  estadoCivil: z.enum(ESTADOS_CIVIS).nullable(),
  enderecoRua: z.string().min(1).nullable(),
  enderecoNumero: z.string().min(1).nullable(),
  enderecoBairro: z.string().min(1).nullable(),
  enderecoCidade: z.string().min(1).nullable(),
  enderecoEstado: z.enum(UFS).nullable(),
  enderecoCep: z.string().regex(/^\d{8}$/).nullable(),
});
export type EmployeeCreateInput = z.infer<typeof EmployeeCreateSchema>;
